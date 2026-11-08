import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { promiseEvent } from "@/db/schema";
import { logEvent } from "@/lib/events";
import { indexVerdict } from "@/lib/integrations/elastic";
import { isOn } from "@/lib/integrations/registry";
import type { Condition, Verdict } from "@/lib/verdict";
import { traced } from "../trace";
import type { AgentCtx } from "../types";

/**
 * Appends ONE summary row (event counts by kind) for the UI, then indexes the verdict in Elastic (if on). Append-only:
 * it never rewrites or deletes history. "summary" rows are excluded from the tally.
 */
export async function runArchivist(ctx: AgentCtx, signal: AbortSignal, verdict: Verdict, condition: Condition): Promise<Record<string, number>> {
  const rows = await getDb().select({ kind: promiseEvent.kind }).from(promiseEvent).where(eq(promiseEvent.promiseId, ctx.promiseId));
  if (signal.aborted) throw new Error("archivist aborted");

  const tally: Record<string, number> = {};
  for (const r of rows) if (r.kind !== "summary") tally[r.kind] = (tally[r.kind] ?? 0) + 1;

  await logEvent(ctx.promiseId, ctx.attempt, "summary", { tally });

  // Index the final verdict so future promises can find it as precedent. Failure never matters here.
  if (isOn("elastic")) {
    await traced(ctx.emit, "elastic.index", { reason: verdict.reason }, async () => {
      const r = await indexVerdict({ promiseId: ctx.promiseId, condition, verdict, at: new Date(ctx.nowMs).toISOString() });
      if (!r.ok) throw new Error(r.reason);
    }).catch(() => undefined);
  }
  return tally;
}
