import type { RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../lib/errors";

const uuid = z.uuid();

// Rejects malformed :id params before they reach Prisma (which would throw on a bad uuid cast).
export function validateId(param: string, label: string): RequestHandler {
  return (req, _res, next) => {
    if (!uuid.safeParse(req.params[param]).success) throw new HttpError(400, `Invalid ${label} id.`);
    next();
  };
}

// Replaces req.body with the parsed (trimmed, defaulted, transformed) value.
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

// req.query is read-only in Express 5, so the parsed query goes to res.locals.query.
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    res.locals.query = schema.parse(req.query);
    next();
  };
}
