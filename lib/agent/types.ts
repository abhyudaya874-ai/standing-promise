// Contracts for the runtime agent layer.
// Rule: subagents produce typed DATA. They never call computeVerdict and never build a Verdict.
import type { CaptureStatus, PromiseState } from "@/db/schema";
import type { ConditionFact, Fact, Terms, Verdict } from "@/lib/verdict";

export type SubagentId = "guard" | "observer" | "resolver" | "reconciler" | "explainer" | "nudger" | "archivist";
export type SubagentState = "pending" | "running" | "ok" | "error" | "skipped";

export type Emit = (e: TraceEvent) => void;

export type TraceEvent =
  | { kind: "tool"; id: string; name: string; args: Record<string, unknown>; state: "running" | "ok" | "error"; ms?: number; error?: string }
  | { kind: "subagent"; id: string; agent: SubagentId; title: string; state: SubagentState; ms?: number; toolCalls?: number }
  | { kind: "diff"; id: string; path: string; hunks: string[]; state: "streaming" | "settled"; adds?: number; removes?: number }
  | { kind: "thought"; id: string; text: string }
  | { kind: "verdict"; id: string; verdict: Verdict }
  | { kind: "error"; id: string; message: string; retryable: boolean }
  | { kind: "done"; id: string; state: PromiseState; deduped: boolean };

export type SubagentResult<T> =
  | { ok: true; agent: SubagentId; ms: number; data: T }
  | { ok: false; agent: SubagentId; ms: number; error: string; retryable: boolean };

export interface AgentCtx {
  promiseId: string;
  attempt: number;
  nowMs: number; // the ONLY clock agents see; passed in by the route
  signal: AbortSignal;
  emit: Emit;
}

/**
 * What happens to the cycle when this agent fails:
 *  abort   - cycle stops (guard: we cannot even load the promise)
 *  degrade - cycle continues with a safe fallback (observer -> Fact "unavailable" -> WAIT)
 *  ignore  - failure is invisible to the verdict and the capture (explainer, archivist, reconciler)
 */
export type OnFailure = "abort" | "degrade" | "ignore";

export interface AgentProfile {
  id: SubagentId;
  title: string;
  maxMs: number;
  retries: number;
  requiresNetwork: boolean;
  onFailure: OnFailure;
}

export interface GuardFacts {
  terms: Terms; // includes terms.condition
  payer: { name: string; email: string | null };
  orderId: string;
  state: PromiseState;
  existingCapture: CaptureStatus | null; // capture row for (promiseId, attempt), if any
  requestId: string; // `${promiseId}:${attempt}`
}

export interface ObserverResult {
  fact: Fact;
  orderStatus: string;
  observedAtMs: number;
}

export interface ResolverResult {
  world: ConditionFact;
  source: "channel3" | "kernel" | "fetch" | "manual" | "none";
  evidenceUrl: string | null;
  degradedFrom: string[]; // capabilities that were tried and degraded, in order (shown in the trace)
}

export interface Reconciliation {
  captureStatus: CaptureStatus | null;
  orderStatus: string | null;
  drift: boolean;
  note: string;
}

export interface Gathered {
  guard: GuardFacts;
  fact: Fact;
  world: ConditionFact;
  reconciliation: Reconciliation | null;
}
