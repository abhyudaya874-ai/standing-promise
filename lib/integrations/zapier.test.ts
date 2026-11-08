import { describe, expect, it } from "vitest";
import { buildNudge, buildToolArgs, needsFollowUp } from "./zapier";

const base = { promiseId: "12345678-aaaa", payerName: "Asha", payerEmail: "a@b.c", amountLabel: "12.50 USD", daysLate: 3 };

describe("buildNudge", () => {
  it("is friendly and states the amount from the label", () => {
    const n = buildNudge(base);
    expect(n.body).toContain("12.50 USD");
    expect(n.body).toContain("passed 3 days ago");
    expect(n.body.toLowerCase()).toContain("no rush");
    expect(n.body.toLowerCase()).not.toMatch(/overdue|owe|collections|penalty/);
  });
  it("handles 0 and 1 day", () => {
    expect(buildNudge({ ...base, daysLate: 0 }).body).toContain("just passed");
    expect(buildNudge({ ...base, daysLate: 1 }).body).toContain("passed 1 day ago");
  });
});

describe("buildToolArgs adapts to the tool's own schema", () => {
  it("always sends a complete `instructions`, and nothing the schema does not declare", () => {
    const a = buildToolArgs(["instructions"], base);
    expect(Object.keys(a)).toEqual(["instructions"]);
    expect(a.instructions).toContain("a@b.c");
    expect(a.instructions).toContain("A gentle heads-up on your promise");
  });
  it("adds structured fields only when declared", () => {
    const a = buildToolArgs(["instructions", "output_hint", "to", "subject", "body"], base);
    expect(a).toMatchObject({ to: "a@b.c", subject: "A gentle heads-up on your promise" });
    expect(typeof a.body).toBe("string");
    expect(a.output_hint).toBeTruthy();
  });
  it("does not invent keys for other field names", () => {
    expect(Object.keys(buildToolArgs(["instructions", "recipient"], base))).toEqual(["instructions"]);
  });
});

describe("needsFollowUp", () => {
  it("detects Zapier asking for more information", () => {
    expect(needsFollowUp('[{"type":"text","text":"{\\"followUpQuestion\\":\\"Which account?\\"}"}]')).toBe(true);
    expect(needsFollowUp('[{"type":"text","text":"sent"}]')).toBe(false);
  });
});
