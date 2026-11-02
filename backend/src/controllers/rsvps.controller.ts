import type { RequestHandler } from "express";
import { Prisma, RsvpStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/errors";
import { toCsv } from "../lib/csv";
import { bookingTransaction, fillFreeSeats, lockEvent } from "../lib/booking";
import type { CancelInput, RsvpInput, StatusFilter } from "../schemas/rsvp.schema";

type IdParams = { id: string };
type QueryLocals = { query: StatusFilter };

const publicFields = { cancelToken: true } as const;

export const createRsvp: RequestHandler<IdParams, unknown, RsvpInput> = async (req, res) => {
  const eventId = req.params.id;
  const { name, email } = req.body;

  try {
    const rsvp = await bookingTransaction(async (tx) => {
      const event = await lockEvent(tx, eventId);
      if (event.startsAt.getTime() <= Date.now()) {
        throw new HttpError(409, "This event has already started, so registration is closed.");
      }

      const confirmed = await tx.rsvp.count({ where: { eventId, status: "CONFIRMED" } });
      const status = confirmed < event.capacity ? RsvpStatus.CONFIRMED : RsvpStatus.WAITLISTED;
      const created = await tx.rsvp.create({ data: { eventId, name, email, status } });

      const waitlistPosition =
        status === RsvpStatus.WAITLISTED
          ? await tx.rsvp.count({ where: { eventId, status: "WAITLISTED" } })
          : null;
      return { ...created, waitlistPosition };
    });

    res.status(201).json({ data: rsvp });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "This email address is already registered for this event.");
    }
    throw err;
  }
};

export const listRsvps: RequestHandler<IdParams, unknown, unknown, unknown, QueryLocals> = async (req, res) => {
  const eventId = req.params.id;
  const { status } = res.locals.query;
  await ensureEventExists(eventId);

  const rsvps = await prisma.rsvp.findMany({
    where: { eventId, status },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    omit: publicFields,
  });

  let position = 0;
  res.json({
    data: rsvps.map((r) => ({ ...r, waitlistPosition: r.status === "WAITLISTED" ? ++position : null })),
  });
};

export const exportRsvpsCsv: RequestHandler<IdParams, unknown, unknown, unknown, QueryLocals> = async (req, res) => {
  const eventId = req.params.id;
  const { status } = res.locals.query;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { title: true } });
  if (!event) throw new HttpError(404, "Event not found.");

  const rsvps = await prisma.rsvp.findMany({
    where: { eventId, status },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { name: true, email: true, status: true, createdAt: true },
  });

  const body = toCsv([
    ["Name", "Email", "Status", "RSVP Time"],
    ...rsvps.map((r) => [r.name, r.email, r.status, r.createdAt.toISOString()]),
  ]);

  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "event";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-rsvps.csv"`);
  res.send(body);
};

export const cancelRsvp: RequestHandler<IdParams, unknown, CancelInput> = async (req, res) => {
  const { id } = req.params;
  const { token } = req.body;

  const existing = await prisma.rsvp.findUnique({ where: { id }, select: { eventId: true } });
  if (!existing) throw new HttpError(404, "RSVP not found.");

  const result = await bookingTransaction(async (tx) => {
    const event = await lockEvent(tx, existing.eventId);
    const rsvp = await tx.rsvp.findUnique({ where: { id } });
    if (!rsvp) throw new HttpError(404, "RSVP not found.");
    authorizeCancellation(rsvp.cancelToken, token);
    if (rsvp.status === RsvpStatus.CANCELLED) throw new HttpError(409, "This RSVP has already been cancelled.");

    const cancelled = await tx.rsvp.update({
      where: { id },
      data: { status: RsvpStatus.CANCELLED },
      omit: publicFields,
    });
    const promoted =
      rsvp.status === RsvpStatus.CONFIRMED ? await fillFreeSeats(tx, rsvp.eventId, event.capacity) : [];
    return { rsvp: cancelled, promoted: promoted[0] ?? null };
  });

  res.json({ data: result });
};

// No token = organizer action. Require an organizer session here once auth exists.
function authorizeCancellation(expected: string, provided: string | undefined) {
  if (provided !== undefined && provided !== expected) {
    throw new HttpError(403, "This cancellation link is not valid for this RSVP.");
  }
}

async function ensureEventExists(eventId: string) {
  const found = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!found) throw new HttpError(404, "Event not found.");
}
