import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/errors";

const DB_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: { message: "Please correct the highlighted fields.", fields: z.flattenError(err).fieldErrors },
    });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { message: "Request body must be valid JSON." } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      res.status(404).json({ error: { message: "Record not found." } });
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json({ error: { message: "This record already exists." } });
      return;
    }
  }
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && DB_UNAVAILABLE_CODES.has(err.code))
  ) {
    console.error("Database unavailable:", err.message);
    res.status(503).json({ error: { message: "The database is currently unavailable. Please try again shortly." } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: "Something went wrong. Please try again." } });
};
