// @deterministic — same input, same output, no side effects.
// This file imports NOTHING. No fetch, no clock, no random, no env, no console.
// Time arrives as `nowMs`. Vendor data arrives as `world` (a stored snapshot), never fetched here.
// To add a reason code: see .devin/workflows/add-reason-code.md

// @invariant:closed-reason-codes
export const REASON_CODES = [
  "AMOUNT_MET",
  "AMOUNT_SHORT",
  "WINDOW_EXPIRED",
  "WINDOW_OPEN",
  "FACT_MISSING",
  "CURRENCY_MISMATCH",
  "CONDITION_MET",
  "CONDITION_PENDING",
  "CONDITION_UNMET",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export type VerdictKind = "met" | "unmet" | "indeterminate";
export type Consequence = "CAPTURE" | "RELEASE" | "WAIT";

/** What the payer is waiting for in the world. Fully serialisable. `query`/`url` are for the resolver, ignored here. */
export type Condition =
  | { kind: "none" }
  | { kind: "price_at_most"; query: string; ceilingMinor: number; currency: string }
  | { kind: "page_contains"; url: string; needle: string };

export interface Terms {
  amountMinor: number; // integer minor units, > 0
  currency: string; // ISO 4217, e.g. "USD"
  windowEndsAtMs: number; // epoch ms
  condition: Condition;
}

/** PayPal side: what the observer saw. Exactly three states, switch is exhaustive. */
export type Fact =
  | { kind: "observed"; observedMinor: number; currency: string } // payer approved this amount
  | { kind: "none" } // provider reachable, nothing approved yet
  | { kind: "unavailable" }; // could not look (network / provider error)

/** World side: a stored snapshot from Channel3 / KERNEL / manual entry. The verdict never fetches it. */
export type ConditionFact =
  | { kind: "not_checked" } // no condition, or resolver did not run
  | { kind: "product"; priceMinor: number; currency: string; inStock: boolean }
  | { kind: "page"; text: string }
  | { kind: "unavailable" }; // vendor down AND no manual snapshot

export interface VerdictInput {
  terms: Terms;
  fact: Fact;
  world: ConditionFact;
  nowMs: number; // passed in, never read
}

export interface Verdict {
  kind: VerdictKind;
  reason: ReasonCode;
  consequence: Consequence;
  diag: {
    committedMinor: number;
    observedMinor: number | null;
    conditionKind: Condition["kind"];
    windowEndsAtMs: number;
    nowMs: number;
    windowClosed: boolean;
  };
}

// @invariant:verdict-carries-its-consequence
// Record<ReasonCode, ...> means a new code is a COMPILE ERROR until it has a row here.
const OUTCOME: Record<ReasonCode, { kind: VerdictKind; consequence: Consequence }> = {
  AMOUNT_MET: { kind: "met", consequence: "CAPTURE" },
  AMOUNT_SHORT: { kind: "unmet", consequence: "RELEASE" },
  WINDOW_EXPIRED: { kind: "unmet", consequence: "RELEASE" },
  WINDOW_OPEN: { kind: "indeterminate", consequence: "WAIT" },
  FACT_MISSING: { kind: "indeterminate", consequence: "WAIT" },
  CURRENCY_MISMATCH: { kind: "indeterminate", consequence: "WAIT" },
  CONDITION_MET: { kind: "met", consequence: "CAPTURE" },
  CONDITION_PENDING: { kind: "indeterminate", consequence: "WAIT" },
  CONDITION_UNMET: { kind: "unmet", consequence: "RELEASE" },
};

/** Second gate: the payment is fine, is the world condition true? Only called once payment is OK. */
function decideCondition(terms: Terms, world: ConditionFact, closed: boolean): ReasonCode {
  const c = terms.condition;
  switch (c.kind) {
    case "none":
      return "AMOUNT_MET";
    case "price_at_most": {
      if (world.kind !== "product") return "FACT_MISSING"; // blind spot: WAIT, never RELEASE
      if (world.currency !== c.currency) return "CURRENCY_MISMATCH";
      if (!Number.isInteger(world.priceMinor) || world.priceMinor < 0) return "FACT_MISSING";
      if (world.inStock && world.priceMinor <= c.ceilingMinor) return "CONDITION_MET";
      return closed ? "CONDITION_UNMET" : "CONDITION_PENDING";
    }
    case "page_contains": {
      if (world.kind !== "page") return "FACT_MISSING";
      if (world.text.includes(c.needle)) return "CONDITION_MET";
      return closed ? "CONDITION_UNMET" : "CONDITION_PENDING";
    }
    default: {
      const unreachable: never = c;
      throw new Error(`unhandled condition: ${JSON.stringify(unreachable)}`);
    }
  }
}

function decide(input: VerdictInput): ReasonCode {
  const { terms, fact, world, nowMs } = input;
  const closed = nowMs >= terms.windowEndsAtMs;
  switch (fact.kind) {
    case "unavailable":
      return "FACT_MISSING";
    case "none":
      return closed ? "WINDOW_EXPIRED" : "WINDOW_OPEN";
    case "observed": {
      if (!Number.isInteger(fact.observedMinor) || fact.observedMinor < 0) return "FACT_MISSING";
      if (fact.currency !== terms.currency) return "CURRENCY_MISMATCH";
      if (fact.observedMinor >= terms.amountMinor) return decideCondition(terms, world, closed);
      return closed ? "AMOUNT_SHORT" : "WINDOW_OPEN";
    }
    default: {
      const unreachable: never = fact;
      throw new Error(`unhandled fact: ${JSON.stringify(unreachable)}`);
    }
  }
}

export function computeVerdict(input: VerdictInput): Verdict {
  const { terms, fact, nowMs } = input;
  if (!Number.isInteger(terms.amountMinor) || terms.amountMinor <= 0) {
    throw new Error("terms.amountMinor must be a positive integer (minor units)");
  }
  const reason = decide(input);
  const { kind, consequence } = OUTCOME[reason];
  return {
    kind,
    reason,
    consequence,
    diag: {
      committedMinor: terms.amountMinor,
      observedMinor: fact.kind === "observed" ? fact.observedMinor : null,
      conditionKind: terms.condition.kind,
      windowEndsAtMs: terms.windowEndsAtMs,
      nowMs,
      windowClosed: nowMs >= terms.windowEndsAtMs,
    },
  };
}
