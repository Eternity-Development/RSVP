import { Prisma, type PrismaClient, type Event } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./errors";

type Db = PrismaClient | Prisma.TransactionClient;

function isRetryable(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const sqlState = (err.meta as { code?: string } | undefined)?.code;
  return err.code === "P2034" || (err.code === "P2010" && (sqlState === "40001" || sqlState === "40P01"));
}

export async function bookingTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { maxWait: 10_000, timeout: 15_000 });
    } catch (err) {
      if (attempt >= attempts || !isRetryable(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt));
    }
  }
}

// Row lock on the event: all seat-changing transactions for one event run one at a time.
export async function lockEvent(tx: Prisma.TransactionClient, eventId: string) {
  const [event] = await tx.$queryRaw<{ capacity: number; startsAt: Date }[]>`
    SELECT "capacity", "startsAt" FROM "Event" WHERE "id" = ${eventId}::uuid FOR UPDATE`;
  if (!event) throw new HttpError(404, "Event not found.");
  return event;
}

export async function fillFreeSeats(tx: Prisma.TransactionClient, eventId: string, capacity: number) {
  const confirmed = await tx.rsvp.count({ where: { eventId, status: "CONFIRMED" } });
  if (confirmed >= capacity) return [];

  const next = await tx.rsvp.findMany({
    where: { eventId, status: "WAITLISTED" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: capacity - confirmed,
    select: { id: true, name: true, email: true },
  });
  if (next.length) {
    await tx.rsvp.updateMany({ where: { id: { in: next.map((r) => r.id) } }, data: { status: "CONFIRMED" } });
  }
  return next;
}

export async function countRsvps(db: Db, eventIds: string[]) {
  const groups = await db.rsvp.groupBy({
    by: ["eventId", "status"],
    where: { eventId: { in: eventIds } },
    _count: { _all: true },
  });
  const counts = new Map(eventIds.map((id) => [id, { confirmed: 0, waitlisted: 0 }]));
  for (const g of groups) {
    const entry = counts.get(g.eventId)!;
    if (g.status === "CONFIRMED") entry.confirmed = g._count._all;
    if (g.status === "WAITLISTED") entry.waitlisted = g._count._all;
  }
  return counts;
}

export function withSeatInfo(event: Event, counts: { confirmed: number; waitlisted: number }) {
  const seatsRemaining = Math.max(0, event.capacity - counts.confirmed);
  return { ...event, confirmedCount: counts.confirmed, waitlistCount: counts.waitlisted, seatsRemaining, isFull: seatsRemaining === 0 };
}

export async function getEventWithSeats(db: Db, eventId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new HttpError(404, "Event not found.");
  return withSeatInfo(event, (await countRsvps(db, [eventId])).get(eventId)!);
}
