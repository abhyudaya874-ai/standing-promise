import { describe, expect, it } from "vitest";
import { stillToComeCopy, STILL_TO_COME_EMPTY, STILL_TO_COME_TITLE } from "./still-to-come-copy";

// The nudge word-list: collections voice is banned everywhere user-facing (same regex as zapier.test.ts).
const BANNED = /overdue|owe|collections|penalty/i;

const row = (over: Partial<Parameters<typeof stillToComeCopy>[0][number]> = {}) => ({
  customer: "Ada Lovelace",
  amountMinor: 4250,
  currency: "USD",
  status: "UNPAID",
  dueAt: "2026-11-15T00:00:00Z",
  ...over,
});

describe("stillToComeCopy", () => {
  it("titles the widget 'Still to come' and empties with the friendly line", () => {
    const c = stillToComeCopy([]);
    expect(c.title).toBe(STILL_TO_COME_TITLE);
    expect(c.empty).toBe(STILL_TO_COME_EMPTY);
    expect(c.items).toEqual([]);
  });

  it("keeps only waiting statuses and formats amount + status + due date", () => {
    const c = stillToComeCopy([
      row(),
      row({ status: "PAID" }),
      row({ status: "CANCELLED" }),
      row({ customer: "", status: "SENT", dueAt: null }),
    ]);
    expect(c.items).toHaveLength(2);
    expect(c.items[0]).toEqual({ label: "Ada Lovelace", detail: "42.50 USD · waiting on payment · due Nov 15" });
    expect(c.items[1]).toEqual({ label: "A customer", detail: "42.50 USD · sent, waiting on them" });
  });

  it("never uses collections voice in any string it produces", () => {
    const statuses = ["SENT", "UNPAID", "PAYMENT_PENDING", "PARTIALLY_PAID", "SCHEDULED", "PAID", "CANCELLED", "WHATEVER"];
    const c = stillToComeCopy(statuses.map((s) => row({ status: s, customer: "" })));
    const all = [c.title, c.empty, ...c.items.flatMap((i) => [i.label, i.detail])].join(" ");
    expect(all).not.toMatch(BANNED);
    expect(STILL_TO_COME_TITLE).not.toMatch(BANNED);
    expect(STILL_TO_COME_EMPTY).not.toMatch(BANNED);
  });
});
