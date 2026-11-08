import { describe, expect, it } from "vitest";
import { SUPPORTED_CURRENCIES, formatMajor, minorFromJson, parseMinor } from "./money";

describe("parseMinor", () => {
  const ok: [string, string, number][] = [
    ["10", "USD", 1000],
    ["10.5", "USD", 1050],
    ["10.05", "USD", 1005],
    ["0.01", "USD", 1],
    ["500", "JPY", 500],
  ];
  it.each(ok)("%s %s -> %i", (v, c, want) => expect(parseMinor(v, c)).toBe(want));

  const bad: [string, string][] = [
    ["", "USD"], ["abc", "USD"], ["-1", "USD"], ["1.234", "USD"], ["1.5", "JPY"], ["1e3", "USD"], ["10", "XXX"],
  ];
  it.each(bad)("rejects %j %s", (v, c) => expect(() => parseMinor(v, c)).toThrow());
});

describe("formatMajor", () => {
  const rows: [number, string, string][] = [[1050, "USD", "10.50"], [5, "USD", "0.05"], [0, "USD", "0.00"], [500, "JPY", "500"]];
  it.each(rows)("%i %s -> %s", (m, c, want) => expect(formatMajor(m, c)).toBe(want));
  it("round-trips", () => expect(parseMinor(formatMajor(12345, "EUR"), "EUR")).toBe(12345));
});

describe("payable vs parseable currencies", () => {
  it("INR is parseable but not in the payable list", () => {
    expect(parseMinor("10", "INR")).toBe(1000);
    expect((SUPPORTED_CURRENCIES as readonly string[]).includes("INR")).toBe(false);
  });
  it("USD is payable", () => expect((SUPPORTED_CURRENCIES as readonly string[]).includes("USD")).toBe(true));
});

describe("minorFromJson", () => {
  const ok: [number | string, string, number][] = [[399.99, "USD", 39999], [128, "USD", 12800], [0.1, "USD", 10], ["4000", "INR", 400000]  /* parseable even though not payable */, [500, "JPY", 500]];
  it.each(ok)("%s %s -> %i", (v, c, want) => expect(minorFromJson(v, c)).toBe(want));
  it.each([NaN, Infinity, -1, 1e21, 0.001])("rejects %s", (v) => expect(() => minorFromJson(v, "USD")).toThrow());
});
