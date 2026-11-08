import { isDeepStrictEqual } from "node:util";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { promiseEvent } from "@/db/schema";
import { computeVerdict, type Verdict, type VerdictInput } from "@/lib/verdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only. Loads the stored verdict event (it contains the full input), recomputes with the SAME pure function,
 * and reports whether the two are identical. This is the "call it twice and diff" demo, over HTTP.
 * No vendor is called, so the world moving on cannot change the answer.
 */
export async function GET(req: Request): Promise<Response> {
  const promiseId = new URL(req.url).searchParams.get("promiseId");
  if (!promiseId) return Response.json({ error: "promiseId required" }, { status: 400 });

  const [row] = await getDb()
    .select({ payload: promiseEvent.payload, at: promiseEvent.createdAt })
    .from(promiseEvent)
    .where(and(eq(promiseEvent.promiseId, promiseId), eq(promiseEvent.kind, "verdict")))
    .orderBy(desc(promiseEvent.createdAt))
    .limit(1);
  const payload = row?.payload as { verdict?: Verdict; input?: VerdictInput } | undefined;
  if (!payload?.verdict || !payload.input) return Response.json({ error: "no replayable verdict for this promise" }, { status: 404 });

  const recomputed = computeVerdict(payload.input);
  return Response.json({
    // jsonb does not preserve key order, so a stringify diff would always say "different".
    identical: isDeepStrictEqual(recomputed, payload.verdict),
    stored: payload.verdict,
    recomputed,
    storedAt: row.at.toISOString(),
  });
}
