import express from "express";
import cors from "cors";
import { eventsRouter } from "./routes/events";
import { rsvpsRouter } from "./routes/rsvps";
import { healthCheck } from "./controllers/health.controller";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3001", exposedHeaders: ["Content-Disposition"] }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", healthCheck);
app.use("/api/events", eventsRouter);
app.use("/api", rsvpsRouter);

app.use(notFound);
app.use(errorHandler);
