import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

export const healthCheck: RequestHandler = async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { status: "ok" } });
};
