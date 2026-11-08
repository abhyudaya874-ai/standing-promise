import { describe, expect, it } from "vitest";
import { conditionText, precedentLine } from "./elastic";

describe("elastic pure helpers", () => {
  it("conditionText is stable per condition kind", () => {
    expect(conditionText({ kind: "none" })).toBe("payer approval only");
    expect(conditionText({ kind: "price_at_most", query: "shoes", ceilingMinor: 12000, currency: "USD" })).toBe("price of shoes at most 12000 minor units USD");
  });
  it("precedentLine summarises the most common outcome", () => {
    expect(precedentLine([{ reason: "CONDITION_UNMET" }, { reason: "CONDITION_UNMET" }, { reason: "CONDITION_MET" }])).toBe("2 of 3 similar past promises ended CONDITION_UNMET");
    expect(precedentLine([])).toBeNull();
  });
});
