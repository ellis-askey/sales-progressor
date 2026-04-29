// lib/prisma.ts
// Single Prisma client instance shared across the app.
// Next.js hot-reload in dev can create multiple instances without this pattern.
// Schema: Deploy A — MilestoneState enum, state column, dropped isActive/isNotRequired.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
