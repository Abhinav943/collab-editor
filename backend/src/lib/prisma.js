import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

const globalForPrisma = globalThis;

const base =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

const RETRYABLE = new Set(["P1001", "P1017"]);
const isTransient = (e) =>
  RETRYABLE.has(e?.code) ||
  /Can't reach database server|Server has closed the connection/i.test(
    String(e?.message),
  );

/**
 * Neon's free tier suspends compute when idle. The first query after a wake can
 * fail with P1001 ("Can't reach database server") and then succeed on a retry,
 * so retry transient connection errors a few times before giving up.
 */
export const prisma = base.$extends({
  query: {
    async $allOperations({ args, query }) {
      const tries = 4;
      for (let i = 1; i <= tries; i++) {
        try {
          return await query(args);
        } catch (e) {
          if (!isTransient(e) || i === tries) throw e;
          logger.debug(`db not ready, retry ${i}/${tries - 1}`);
          await new Promise((r) => setTimeout(r, 400 * i));
        }
      }
    },
  },
});
