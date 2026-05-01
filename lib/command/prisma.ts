// Separate PrismaClient instance for command centre use.
// Isolated so command centre queries can have their own log level and
// connection label, without touching the shared app-wide instance.

import { PrismaClient } from "@prisma/client";

const globalForCommandPrisma = globalThis as unknown as {
  commandPrisma: PrismaClient | undefined;
};

export const commandDb =
  globalForCommandPrisma.commandPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForCommandPrisma.commandPrisma = commandDb;
}
