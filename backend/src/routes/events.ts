import { Router } from "express";
import { validateBody, validateId } from "../middleware/validate";
import { createEventSchema, updateEventSchema } from "../schemas/event.schema";
import { createEvent, deleteEvent, getEvent, listEvents, updateEvent } from "../controllers/events.controller";

export const eventsRouter = Router();

const eventId = validateId("id", "event");

eventsRouter.get("/", listEvents);
eventsRouter.post("/", validateBody(createEventSchema), createEvent);
eventsRouter.get("/:id", eventId, getEvent);
eventsRouter.patch("/:id", eventId, validateBody(updateEventSchema), updateEvent);
eventsRouter.delete("/:id", eventId, deleteEvent);
