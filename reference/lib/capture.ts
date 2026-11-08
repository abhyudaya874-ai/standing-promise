import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { capture, promise, type CaptureStatus, type PromiseState } from "@/db/schema";
import { traced } from "@/lib/agent/trace";
import type { Emit } from "@/lib/agent/types";
import { logEvent, setState, type EventKind } from "@/lib/events";
import { paypal } from "@/lib/paypal";

// Support file for app/api/promise/route.ts (pre-approved 5th file, see rules/20-four-files.md).
// Pattern: CLAIM the slot in the DB -> write the event -> call PayPal -> record the result.

export interface SettleCtx {
  promiseId: string;
  attempt: number;
  orderId: string;
  requestId: string; // `${promiseId}:${attempt}`, also the PayPal-Request-Id
  signal: AbortSignal;
  emit: Emit;
}

export interface Outcome {
  state: PromiseState;
  detail: string;
}

const STATE_FOR: Record<CaptureStatus, PromiseState> = {
  pending: "capture_pending",
  completed: "captured",
  declined: "declined",
};

/** Event FIRST, then capture row, then promise projection. A crash in between still tells the story. */
async function record(
  c: SettleCtx,
  status: CaptureStatus,
  kind: EventKind,
  payload: Record<string, unknown>,
  captureId: string | null = null,
): Promise<Outcome> {
  await logEvent(c.promiseId, c.attempt, kind, payload);
  await getDb()
    .update(capture)
    .set({ status, ...(captureId ? { paypalCaptureId: captureId } : {}), updatedAt: new Date() })
    .where(and(eq(capture.promiseId, c.promiseId), eq(capture.attempt, c.attempt)));
  await setState(c.promiseId, STATE_FOR[status]);
  return { state: STATE_FOR[status], detail: kind };
}

// ---- consequence: CAPTURE ----
export async function capturePromise(c: SettleCtx): Promise<Outcome> {
  const db = getDb();

  // @invariant:claim-before-call. The unique (promise_id, attempt) makes a second claim a no-op.
  const claimed = await db
    .insert(capture)
    .values({ promiseId: c.promiseId, attempt: c.attempt, requestId: c.requestId, status: "pending" })
    .onConflictDoNothing()
    .returning({ id: capture.id });

  if (claimed.length === 0) {
    const [existing] = await db
      .select({ status: capture.status })
      .from(capture)
      .where(and(eq(capture.promiseId, c.promiseId), eq(capture.attempt, c.attempt)))
      .limit(1);
    return resume(c, { existingCapture: existing?.status ?? null, state: "open" });
  }

  await logEvent(c.promiseId, c.attempt, "capture_started", { requestId: c.requestId });

  try {
    const outcome = await traced(c.emit, "paypal.captureOrder", { orderId: c.orderId, requestId: c.requestId }, async () => {
      const o = await paypal.captureOrder(c.orderId, c.requestId, { signal: c.signal });
      if (o.kind === "error") throw new Error(`${o.status} ${o.issue}`); // red in the panel, pending in the DB
      return o; // narrowed: completed | declined | already_captured
    });

    switch (outcome.kind) {
      case "completed":
        return await record(c, "completed", "capture_completed", { captureId: outcome.captureId }, outcome.captureId);
      case "already_captured":
        return await record(c, "completed", "capture_completed", { reconciled: true });
      case "declined":
        return await record(c, "declined", "capture_declined", { issue: outcome.issue });
    }
  } catch (err) {
    // Timeout / network / 5xx: NEVER auto-retry. Mark pending; a later settle polls once.
    return record(c, "pending", "capture_pending", { error: err instanceof Error ? err.message : String(err) });
  }
}

// ---- consequence: RELEASE ----
export async function releasePromise(c: SettleCtx): Promise<Outcome> {
  await logEvent(c.promiseId, c.attempt, "released", { requestId: c.requestId });
  await setState(c.promiseId, "released");
  return { state: "released", detail: "condition not met; no capture" };
}

// ---- consequence: WAIT ----
export async function waitPromise(c: SettleCtx): Promise<Outcome> {
  await logEvent(c.promiseId, c.attempt, "waiting", {});
  const [row] = await getDb().select({ state: promise.state }).from(promise).where(eq(promise.id, c.promiseId)).limit(1);
  return { state: row?.state ?? "open", detail: "waiting; state unchanged" }; // never regress capture_pending -> open
}

/** Duplicate / re-click path. Returns the FIRST result. Pending -> poll the provider once, never re-capture. */
export async function resume(
  c: SettleCtx,
  g: { existingCapture: CaptureStatus | null; state: PromiseState },
): Promise<Outcome> {
  if (g.existingCapture === null) return { state: g.state, detail: "already released; nothing to do" };
  if (g.existingCapture !== "pending") {
    return { state: STATE_FOR[g.existingCapture], detail: "duplicate request; returning first result" };
  }
  try {
    const res = await traced(c.emit, "paypal.getOrder", { orderId: c.orderId }, async () => {
      const r = await paypal.getOrder(c.orderId, { signal: c.signal });
      if (!r.ok) throw new Error(`provider ${r.status}: ${r.issue}`);
      return r;
    });
    if (res.orderStatus === "COMPLETED") return await record(c, "completed", "capture_completed", { reconciled: true });
  } catch {
    /* still pending */
  }
  return { state: "capture_pending", detail: "capture still pending; polled once, not retried" };
}
