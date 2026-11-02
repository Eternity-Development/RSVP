import { z } from "zod";

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

export const createEventSchema = z.object({
  ...eventFields,
  description: eventFields.description.default(""),
  startsAt: eventFields.startsAt.refine((d) => d.getTime() > Date.now(), "Start time must be in the future."),
});

export const updateEventSchema = z
  .object(eventFields)
  .partial()
  .refine((e) => Object.keys(e).length > 0, { message: "Provide at least one field to update." });

export type CreateEventInput = z.output<typeof createEventSchema>;
export type UpdateEventInput = z.output<typeof updateEventSchema>;
