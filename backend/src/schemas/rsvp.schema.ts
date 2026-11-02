import { RsvpStatus } from "@prisma/client";
import { z } from "zod";

export const rsvpSchema = z.object({
  name: z.string({ error: "Name is required." }).trim().min(1, "Name is required.").max(120, "Name must be at most 120 characters."),
  email: z
    .string({ error: "Email is required." })
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254, "Email is too long.")),
});

export const cancelSchema = z.object({ token: z.uuid("Invalid cancellation token.").optional() }).default({});

export const statusFilterSchema = z.object({ status: z.enum(RsvpStatus).optional() });

export type RsvpInput = z.output<typeof rsvpSchema>;
export type CancelInput = z.output<typeof cancelSchema>;
export type StatusFilter = z.output<typeof statusFilterSchema>;
