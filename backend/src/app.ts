import express from "express";
import cors from "cors";
import { eventsRouter } from "./routes/events";
import { rsvpsRouter } from "./routes/rsvps";
import { errorHandler } from "./lib/http";
import { prisma } from "./lib/prisma";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3001", exposedHeaders: ["Content-Disposition"] }));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { status: "ok" } });
});

app.use("/api/events", eventsRouter);
app.use("/api", rsvpsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { message: "Not found." } });
});
app.use(errorHandler);
