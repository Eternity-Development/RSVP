import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, parseId } from "../lib/http";
import {
  bookingTransaction,
  countRsvps,
  fillFreeSeats,
  getEventWithSeats,
  lockEvent,
  withSeatInfo,
} from "../lib/booking";

const eventFields = {
  title: z.string({ error: "Title is required." }).trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  description: z.string({ error: "Description must be text." }).trim().max(5000, "Description must be at most 5000 characters."),
  location: z.string({ error: "Venue or meeting link is required." }).trim().min(1, "Venue or meeting link is required.").max(500, "Location must be at most 500 characters."),
  startsAt: z.iso
    .datetime({ offset: true, error: "Start date and time must be a valid date." })
    .transform((value) => new Date(value)),
  capacity: z
    .number({ error: "Capacity must be a number." })
    .int("Capacity must be a whole number.")
    .positive("Capacity must be at least 1.")
    .max(100_000, "Capacity must be at most 100,000."),
};

const createEventSchema = z.object({
  ...eventFields,
  description: eventFields.description.default(""),
  startsAt: eventFields.startsAt.refine((d) => d.getTime() > Date.now(), "Start time must be in the future."),
});

const updateEventSchema = z
  .object(eventFields)
  .partial()
  .refine((e) => Object.keys(e).length > 0, { message: "Provide at least one field to update." });

export const eventsRouter = Router();

eventsRouter.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const counts = await countRsvps(
    prisma,
    events.map((e) => e.id),
  );
  res.json({ data: events.map((e) => withSeatInfo(e, counts.get(e.id)!)) });
});

eventsRouter.post("/", async (req, res) => {
  const input = createEventSchema.parse(req.body);
  const event = await prisma.event.create({ data: input });
  res.status(201).json({ data: withSeatInfo(event, { confirmed: 0, waitlisted: 0 }) });
});

eventsRouter.get("/:id", async (req, res) => {
  const id = parseId(req.params.id, "event");
  res.json({ data: await getEventWithSeats(prisma, id) });
});

eventsRouter.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id, "event");
  const input = updateEventSchema.parse(req.body);

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
});

eventsRouter.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id, "event");
  await prisma.event.delete({ where: { id } });
  res.json({ data: { id } });
});
