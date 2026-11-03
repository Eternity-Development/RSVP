import { Router } from "express";
import { validateBody, validateId, validateQuery } from "../middleware/validate";
import { cancelSchema, rsvpSchema, statusFilterSchema } from "../schemas/rsvp.schema";
import { cancelRsvp, createRsvp, exportRsvpsCsv, listRsvps } from "../controllers/rsvps.controller";

export const rsvpsRouter = Router();

const eventId = validateId("id", "event");
const statusFilter = validateQuery(statusFilterSchema);

rsvpsRouter.post("/events/:id/rsvps", eventId, validateBody(rsvpSchema), createRsvp);
rsvpsRouter.get("/events/:id/rsvps", eventId, statusFilter, listRsvps);
rsvpsRouter.get("/events/:id/rsvps.csv", eventId, statusFilter, exportRsvpsCsv);
rsvpsRouter.patch("/rsvps/:id/cancel", validateId("id", "RSVP"), validateBody(cancelSchema), cancelRsvp);
