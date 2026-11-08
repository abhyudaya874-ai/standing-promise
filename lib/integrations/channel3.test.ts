import { describe, expect, it } from "vitest";
import { parseChannel3 } from "./channel3";

const product = (offers: unknown[]) => ({ products: [{ id: "p1", title: "Shoe", url: "https://x/p1", offers }] });

describe("parseChannel3", () => {
  it("picks the cheapest in-stock offer and converts via minor units", () => {
    const f = parseChannel3(product([
      { price: 129.5, currency: "USD", availability: "InStock", url: "https://a", merchant_domain: "a.com" },
      { price: 99, currency: "USD", availability: "OutOfStock", url: "https://b", merchant_domain: "b.com" },
      { price: 119.99, currency: "USD", availability: "InStock", url: "https://c", merchant_domain: "c.com" },
    ]));
    expect(f).toMatchObject({ priceMinor: 11999, currency: "USD", inStock: true, merchant: "c.com" });
  });
  it("falls back to the cheapest out-of-stock offer, flagged not in stock", () => {
    const f = parseChannel3(product([{ price: 10, currency: "USD", availability: "SoldOut" }]));
    expect(f).toMatchObject({ priceMinor: 1000, inStock: false });
  });
  it("reads an INR price fine; the verdict (not the parser) will WAIT on the currency mismatch", () => {
    expect(parseChannel3(product([{ price: 3999, currency: "INR", availability: "InStock" }]))).toMatchObject({ priceMinor: 399900, currency: "INR" });
  });
  it("skips prices it cannot represent exactly", () => {
    expect(parseChannel3(product([{ price: 1.005, currency: "USD", availability: "InStock" }]))).toBeNull();
  });
  it.each([{}, { products: [] }, { products: [{ id: "x", title: "t" }] }, null])("returns null for %j", (b) => {
    expect(parseChannel3(b)).toBeNull();
  });
});
