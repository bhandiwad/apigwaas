import { z } from "zod";
import { sql } from "drizzle-orm";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

async function checkDatabase(): Promise<"ok" | "error"> {
  try {
    // Lazy import to avoid circular deps at module load
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const url = process.env.DATABASE_URL;
    if (!url) return "error";
    const db = drizzle(postgres(url, { max: 1, connect_timeout: 3 }));
    await db.execute(sql`SELECT 1`);
    return "ok";
  } catch {
    return "error";
  }
}

async function checkGravitee(): Promise<"ok" | "skipped" | "error"> {
  const url = process.env.GRAVITEE_API_URL;
  if (!url) return "skipped";
  try {
    const { getConnectionStatus } = await import("../graviteeSync");
    const status = await getConnectionStatus();
    return status.mode === "live" ? "ok" : "skipped";
  } catch {
    return "error";
  }
}

export const systemRouter = router({
  health: publicProcedure
    .input(z.object({ timestamp: z.number().min(0, "timestamp cannot be negative") }))
    .query(async () => {
      const [database, gravitee] = await Promise.all([checkDatabase(), checkGravitee()]);
      const ok = database === "ok";
      return { ok, checks: { database, gravitee }, timestamp: Date.now() };
    }),

  notifyOwner: adminProcedure
    .input(z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required"),
    }))
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return { success: delivered } as const;
    }),
});
