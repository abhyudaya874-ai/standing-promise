import { describe, expect, it } from "vitest";
import { parseChannel3 } from "./channel3";

// Shape probed from the live v1 API on 2026-11-08: price is {price, compare_at_price, currency}, merchant is `domain`.
const offer = (price: number, currency = "USD", extra: Record<string, unknown> = {}) => ({
  price: { price, compare_at_price: null, currency },
  ...extra,
});
const product = (offers: unknown[]) => ({ products: [{ id: "p1", title: "Shoe", url: "https://x/p1", offers }] });

describe("parseChannel3", () => {
  it("picks the cheapest in-stock offer and converts via minor units", () => {
    const f = parseChannel3(product([
      offer(129.5, "USD", { availability: "InStock", url: "https://a", domain: "a.com" }),
      offer(99, "USD", { availability: "OutOfStock", url: "https://b", domain: "b.com" }),
      offer(119.99, "USD", { availability: "InStock", url: "https://c", domain: "c.com" }),
    ]));
    expect(f).toMatchObject({ priceMinor: 11999, currency: "USD", inStock: true, merchant: "c.com" });
  });
  it("falls back to the cheapest out-of-stock offer, flagged not in stock", () => {
    const f = parseChannel3(product([offer(10, "USD", { availability: "SoldOut" })]));
    expect(f).toMatchObject({ priceMinor: 1000, inStock: false });
  });
  it("reads an INR price fine; the verdict (not the parser) will WAIT on the currency mismatch", () => {
    expect(parseChannel3(product([offer(3999, "INR", { availability: "InStock" })]))).toMatchObject({ priceMinor: 399900, currency: "INR" });
  });
  it("skips prices it cannot represent exactly", () => {
    expect(parseChannel3(product([offer(1.005, "USD", { availability: "InStock" })]))).toBeNull();
  });
  it("defaults the currency to USD when the offer omits it", () => {
    const f = parseChannel3(product([{ price: { price: 20 }, availability: "InStock" }]));
    expect(f).toMatchObject({ priceMinor: 2000, currency: "USD" });
  });
  it.each([{}, { products: [] }, { products: [{ id: "x", title: "t" }] }, null])("returns null for %j", (b) => {
    expect(parseChannel3(b)).toBeNull();
  });
});
