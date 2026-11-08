import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { capture, type CaptureStatus } from "@/db/schema";
import type { AgentCtx, Reconciliation } from "../types";

/**
 * Local capture rows vs the provider's order status (handed in by the observer).
 * LOCAL DB ONLY, no network. Drift is REPORTED, never auto-corrected.
 */
export async function runReconciler(ctx: AgentCtx, orderStatus: string | null, signal: AbortSignal): Promise<Reconciliation> {
  const rows = await getDb().select({ status: capture.status }).from(capture).where(eq(capture.promiseId, ctx.promiseId));
  if (signal.aborted) throw new Error("reconciler aborted");

  const completedLocally = rows.some((r) => r.status === "completed");
  const latest: CaptureStatus | null = rows.length ? (rows[rows.length - 1].status as CaptureStatus) : null;

  let drift = false;
  let note = "consistent";
  if (orderStatus === null) {
    note = "provider state unknown; cannot compare";
  } else if (completedLocally && orderStatus !== "COMPLETED") {
    drift = true;
    note = `local capture completed but provider order is ${orderStatus}`;
  } else if (!completedLocally && orderStatus === "COMPLETED") {
    drift = true;
    note = "provider order is COMPLETED but no completed capture is recorded locally";
  }
  return { captureStatus: latest, orderStatus, drift, note };
}
