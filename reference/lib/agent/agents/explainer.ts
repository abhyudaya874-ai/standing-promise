import { findPrecedent, precedentLine } from "@/lib/integrations/elastic";
import { isOn } from "@/lib/integrations/registry";
import { llm } from "@/lib/llm";
import type { Condition, ReasonCode, Verdict } from "@/lib/verdict";
import { traced } from "../trace";
import type { AgentCtx } from "../types";

/** Deterministic copy used when no model is configured or the model is down. */
export const FALLBACK: Record<ReasonCode, string> = {
  AMOUNT_MET: "The approved amount meets the commitment, so the capture is released.",
  AMOUNT_SHORT: "The window closed with less than the committed amount, so nothing is captured.",
  WINDOW_EXPIRED: "The window closed with no approval, so nothing is captured.",
  WINDOW_OPEN: "The window is still open, so the verdict is deferred.",
  FACT_MISSING: "The evidence could not be read, so nothing is decided or captured yet.",
  CURRENCY_MISMATCH: "A currency does not match the commitment, so nothing is captured.",
  CONDITION_MET: "The approved amount is in and the condition is true, so the capture is released.",
  CONDITION_PENDING: "The payment is in but the condition is not true yet, so we are still waiting.",
  CONDITION_UNMET: "The window closed and the condition never came true, so nothing is captured.",
};

/**
 * Prose about an ALREADY-FINAL verdict. Best-effort. The verdict never waits on it
 * and never depends on it: no key, no network, wrong answer from the model -> template.
 */
export async function runExplainer(ctx: AgentCtx, signal: AbortSignal, verdict: Verdict, condition: Condition): Promise<string> {
  const base = await explain(signal, verdict);
  // Elastic precedent: "2 of 3 similar past promises ended CONDITION_UNMET". Best-effort; off or failing = no line.
  if (!isOn("elastic")) return base;
  try {
    const rows = await traced(ctx.emit, "elastic.precedent", { condition: condition.kind }, async () => {
      const r = await findPrecedent(condition, ctx.promiseId);
      if (!r.ok) throw new Error(r.reason);
      return r.data;
    });
    const line = precedentLine(rows);
    return line ? `${base} (${line}.)` : base;
  } catch {
    return base;
  }
}

async function explain(signal: AbortSignal, verdict: Verdict): Promise<string> {
  const fallback = FALLBACK[verdict.reason];
  if (!llm.configured()) return fallback;
  try {
    const text = await llm.complete(
      [
        "Rewrite this payment verdict as ONE plain sentence. Do not re-derive it. The reason code is authoritative.",
        `code: ${verdict.reason}`,
        `outcome: ${verdict.kind}`,
        `template: ${fallback}`,
      ].join("\n"),
      { signal, maxTokens: 60 },
    );
    return text || fallback;
  } catch {
    return fallback;
  }
}
