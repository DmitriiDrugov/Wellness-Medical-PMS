import { PrismaClient } from "@prisma/client";

// Single shared PrismaClient instance. In dev, Next.js hot-reload can create many
// clients; cache it on globalThis to avoid exhausting the connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
