import { describe, expect, it } from "vitest";
import { REASON_CODES, computeVerdict, type Condition, type ConditionFact, type Fact, type ReasonCode, type Terms } from "./verdict";

const END = 1_000_000;
const OPEN = END - 1; // window still open
const CLOSED = END; // boundary: closed exactly at windowEndsAtMs
const none: Condition = { kind: "none" };
const price: Condition = { kind: "price_at_most", query: "shoes", ceilingMinor: 12_000, currency: "USD" }; // $120.00
const page: Condition = { kind: "page_contains", url: "https://example.com", needle: "In stock" };
const mk = (condition: Condition, currency = "USD", amountMinor = 1000): Terms => ({ amountMinor, currency, windowEndsAtMs: END, condition });

const paid: Fact = { kind: "observed", observedMinor: 1000, currency: "USD" };
const nc: ConditionFact = { kind: "not_checked" };

// One row per behaviour. Add a row when you add a code. Columns: reason, terms, fact, world, nowMs, kind, consequence.
type Row = [ReasonCode, Terms, Fact, ConditionFact, number, string, string];
const TABLE: Row[] = [
  // --- payment side (no condition) ---
  ["AMOUNT_MET", mk(none), paid, nc, OPEN, "met", "CAPTURE"],
  ["AMOUNT_MET", mk(none), { kind: "observed", observedMinor: 5000, currency: "USD" }, nc, CLOSED, "met", "CAPTURE"], // late but met: documented decision
  ["AMOUNT_SHORT", mk(none), { kind: "observed", observedMinor: 999, currency: "USD" }, nc, CLOSED, "unmet", "RELEASE"],
  ["WINDOW_OPEN", mk(none), { kind: "observed", observedMinor: 999, currency: "USD" }, nc, OPEN, "indeterminate", "WAIT"],
  ["WINDOW_OPEN", mk(none), { kind: "none" }, nc, OPEN, "indeterminate", "WAIT"],
  ["WINDOW_EXPIRED", mk(none), { kind: "none" }, nc, CLOSED, "unmet", "RELEASE"],
  ["FACT_MISSING", mk(none), { kind: "unavailable" }, nc, OPEN, "indeterminate", "WAIT"],
  ["FACT_MISSING", mk(none), { kind: "unavailable" }, nc, CLOSED, "indeterminate", "WAIT"], // never RELEASE on a blind spot
  ["FACT_MISSING", mk(none), { kind: "observed", observedMinor: 10.5, currency: "USD" }, nc, OPEN, "indeterminate", "WAIT"],
  ["FACT_MISSING", mk(none), { kind: "observed", observedMinor: -1, currency: "USD" }, nc, OPEN, "indeterminate", "WAIT"],
  ["CURRENCY_MISMATCH", mk(none), { kind: "observed", observedMinor: 9999, currency: "EUR" }, nc, OPEN, "indeterminate", "WAIT"],
  // --- world condition: price_at_most (Channel3 snapshot) ---
  ["CONDITION_MET", mk(price), paid, { kind: "product", priceMinor: 11_999, currency: "USD", inStock: true }, OPEN, "met", "CAPTURE"],
  ["CONDITION_MET", mk(price), paid, { kind: "product", priceMinor: 12_000, currency: "USD", inStock: true }, OPEN, "met", "CAPTURE"], // ceiling is inclusive
  ["CONDITION_PENDING", mk(price), paid, { kind: "product", priceMinor: 12_001, currency: "USD", inStock: true }, OPEN, "indeterminate", "WAIT"],
  ["CONDITION_PENDING", mk(price), paid, { kind: "product", priceMinor: 100, currency: "USD", inStock: false }, OPEN, "indeterminate", "WAIT"], // cheap but out of stock
  ["CONDITION_UNMET", mk(price), paid, { kind: "product", priceMinor: 12_001, currency: "USD", inStock: true }, CLOSED, "unmet", "RELEASE"],
  ["CURRENCY_MISMATCH", mk(price), paid, { kind: "product", priceMinor: 100, currency: "INR", inStock: true }, OPEN, "indeterminate", "WAIT"], // an INR product vs a USD promise (INR is not payable)
  ["FACT_MISSING", mk(price), paid, { kind: "unavailable" }, CLOSED, "indeterminate", "WAIT"], // vendor down: WAIT, never RELEASE
  ["FACT_MISSING", mk(price), paid, { kind: "page", text: "x" }, OPEN, "indeterminate", "WAIT"], // wrong snapshot kind
  // payment problems win over the world: a short payment is AMOUNT_SHORT even if the price dropped
  ["AMOUNT_SHORT", mk(price), { kind: "observed", observedMinor: 1, currency: "USD" }, { kind: "product", priceMinor: 1, currency: "USD", inStock: true }, CLOSED, "unmet", "RELEASE"],
  // --- world condition: page_contains (KERNEL / fetch snapshot) ---
  ["CONDITION_MET", mk(page), paid, { kind: "page", text: "Hello. In stock now." }, OPEN, "met", "CAPTURE"],
  ["CONDITION_PENDING", mk(page), paid, { kind: "page", text: "Sold out" }, OPEN, "indeterminate", "WAIT"],
  ["CONDITION_UNMET", mk(page), paid, { kind: "page", text: "Sold out" }, CLOSED, "unmet", "RELEASE"],
];

describe("computeVerdict table", () => {
  it.each(TABLE)("%s | %j | %j | %j | now=%i", (reason, terms, fact, world, nowMs, kind, consequence) => {
    const v = computeVerdict({ terms, fact, world, nowMs });
    expect(v.reason).toBe(reason);
    expect(v.kind).toBe(kind);
    expect(v.consequence).toBe(consequence);
  });

  it("every reason code has at least one table row", () => {
    const covered = new Set(TABLE.map((r) => r[0]));
    for (const code of REASON_CODES) expect(covered.has(code), `missing row for ${code}`).toBe(true);
  });
});

describe("determinism", () => {
  const input = { terms: mk(price), fact: paid, world: { kind: "product", priceMinor: 1, currency: "USD", inStock: true } as ConditionFact, nowMs: OPEN };
  it("same input twice is byte-identical", () => {
    expect(JSON.stringify(computeVerdict(input))).toBe(JSON.stringify(computeVerdict(input)));
  });
  it("survives a JSON round trip of its input (this is what replay relies on)", () => {
    const replayed = JSON.parse(JSON.stringify(input)) as typeof input;
    expect(computeVerdict(replayed)).toEqual(computeVerdict(input));
  });
  it("does not mutate its input", () => {
    const before = JSON.stringify(input);
    computeVerdict(input);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("boundary: open at END-1, closed at END", () => {
    expect(computeVerdict({ ...input, nowMs: END - 1 }).diag.windowClosed).toBe(false);
    expect(computeVerdict({ ...input, nowMs: END }).diag.windowClosed).toBe(true);
  });
});

describe("bad terms", () => {
  it.each([0, -5, 10.5])("throws on amountMinor=%s", (amountMinor) => {
    expect(() => computeVerdict({ terms: mk(none, "USD", amountMinor), fact: { kind: "none" }, world: nc, nowMs: OPEN })).toThrow();
  });
});
