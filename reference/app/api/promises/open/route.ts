import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { promise } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only. The Render sweep task asks "what is still open?", then settles each through POST /api/promise. */
export async function GET(): Promise<Response> {
  const rows = await getDb().select({ id: promise.id, windowEndsAt: promise.windowEndsAt }).from(promise).where(eq(promise.state, "open")).limit(200);
  return Response.json(rows.map((r) => ({ id: r.id, windowEndsAt: r.windowEndsAt.toISOString() })));
}
