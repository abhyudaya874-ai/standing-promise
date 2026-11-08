import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { promise, promiseEvent, type PromiseState } from "@/db/schema";

// Closed set. Adding a kind = edit this array + CODEMAP.md. Free-text kinds are a bug.
export const EVENT_KINDS = [
  "created",
  "verdict",
  "capture_started",
  "capture_completed",
  "capture_declined",
  "capture_pending",
  "released",
  "waiting",
  "summary",
  "snapshot",
  "degraded",
  "nudge_sent",
  "rescheduled",
  "manual_fact",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Append one row. Never update, never delete. */
export async function logEvent(
  promiseId: string,
  attempt: number,
  kind: EventKind,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await getDb().insert(promiseEvent).values({ promiseId, attempt, kind, payload });
}

/** The promise row is a projection. Always call logEvent FIRST, then setState. */
export async function setState(promiseId: string, state: PromiseState): Promise<void> {
  await getDb().update(promise).set({ state }).where(eq(promise.id, promiseId));
}
