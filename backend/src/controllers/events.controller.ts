import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/errors";
import {
  bookingTransaction,
  countRsvps,
  fillFreeSeats,
  getEventWithSeats,
  lockEvent,
  withSeatInfo,
} from "../lib/booking";
import type { CreateEventInput, UpdateEventInput } from "../schemas/event.schema";

type IdParams = { id: string };

export const listEvents: RequestHandler = async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const counts = await countRsvps(
    prisma,
    events.map((e) => e.id),
  );
  res.json({ data: events.map((e) => withSeatInfo(e, counts.get(e.id)!)) });
};

export const createEvent: RequestHandler<{}, unknown, CreateEventInput> = async (req, res) => {
  const event = await prisma.event.create({ data: req.body });
  res.status(201).json({ data: withSeatInfo(event, { confirmed: 0, waitlisted: 0 }) });
};

export const getEvent: RequestHandler<IdParams> = async (req, res) => {
  res.json({ data: await getEventWithSeats(prisma, req.params.id) });
};

export const updateEvent: RequestHandler<IdParams, unknown, UpdateEventInput> = async (req, res) => {
  const { id } = req.params;
  const input = req.body;

  const result = await bookingTransaction(async (tx) => {
    const current = await lockEvent(tx, id);

    const startsAtChanged = input.startsAt && input.startsAt.getTime() !== current.startsAt.getTime();
    if (startsAtChanged && input.startsAt!.getTime() <= Date.now()) {
      throw new HttpError(400, "Start time must be in the future.");
    }

    if (input.capacity !== undefined && input.capacity < current.capacity) {
      const confirmed = await tx.rsvp.count({ where: { eventId: id, status: "CONFIRMED" } });
      if (input.capacity < confirmed) {
        throw new HttpError(
          409,
          `Capacity cannot be lower than the ${confirmed} confirmed attendee${confirmed === 1 ? "" : "s"}.`,
        );
      }
    }

    const updated = await tx.event.update({ where: { id }, data: input });
    const promoted = input.capacity !== undefined ? await fillFreeSeats(tx, id, updated.capacity) : [];
    return { event: await getEventWithSeats(tx, id), promoted };
  });

  res.json({ data: result });
};

export const deleteEvent: RequestHandler<IdParams> = async (req, res) => {
  const { id } = req.params;
  await prisma.event.delete({ where: { id } });
  res.json({ data: { id } });
};
