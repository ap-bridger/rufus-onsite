import { PrismaClient as PrismaClientClass } from "@prisma/client";

// This prevents an issue with hot reloading during tests
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientClass | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClientClass();
export type PrismaClient = typeof prisma;

// If we were to deploy this code, uncomment here
// if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
globalForPrisma.prisma = prisma;

export { prisma };
