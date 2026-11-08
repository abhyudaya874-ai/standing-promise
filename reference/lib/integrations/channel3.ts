import { z } from "zod";
import { getEnv } from "@/lib/env";
import { minorFromJson } from "@/lib/money";
import { degrade, guard, isOn } from "./registry";
import type { AdapterResult, ProductFact } from "./types";

const BASE = "https://api.trychannel3.com"; // v1 search. Auth is the x-api-key header (NOT a Bearer token).
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; fact: ProductFact }>();

const Offer = z.object({
  price: z.number(),
  currency: z.string().default("USD"),
  availability: z.string().optional(), // "InStock" | "OutOfStock" | ...
  url: z.string().optional(),
  merchant_domain: z.string().optional(),
});
const Product = z.object({ id: z.string(), title: z.string(), url: z.string().optional(), offers: z.array(Offer).optional() });
const Body = z.object({ products: z.array(Product) });

/**
 * Pure. Takes the best-matching product (first), then its cheapest IN-STOCK offer,
 * else its cheapest offer marked out of stock. Prices go through minorFromJson, never `* 100`.
 * Returns null when there is nothing priced.
 */
export function parseChannel3(body: unknown): ProductFact | null {
  const parsed = Body.safeParse(body);
  const product = parsed.success ? parsed.data.products[0] : undefined;
  if (!product) return null;

  const priced = (product.offers ?? []).flatMap((o) => {
    try {
      return [{ o, minor: minorFromJson(o.price, o.currency), inStock: o.availability === "InStock" }];
    } catch {
      return []; // an unparseable price is skipped, not guessed
    }
  });
  if (priced.length === 0) return null;

  const stocked = priced.filter((p) => p.inStock);
  const pool = stocked.length ? stocked : priced;
  const best = pool.reduce((a, b) => (b.minor < a.minor ? b : a));

  return {
    productId: product.id,
    title: product.title,
    priceMinor: best.minor,
    currency: best.o.currency,
    inStock: best.inStock,
    merchant: best.o.merchant_domain ?? "unknown",
    buyUrl: best.o.url ?? product.url ?? "",
  };
}

export async function searchProduct(query: string, signal?: AbortSignal): Promise<AdapterResult<ProductFact>> {
  if (!isOn("channel3")) return degrade("channel3 off");
  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < TTL_MS) return { ok: true, data: hit.fact };

  return guard("channel3", async () => {
    const res = await fetch(`${BASE}/v1/search`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": getEnv().CHANNEL3_API_KEY ?? "" },
      body: JSON.stringify({ query, limit: 5 }),
      signal: signal ?? AbortSignal.timeout(3_000),
    });
    if (!res.ok) return degrade(`channel3 http ${res.status}`);
    const fact = parseChannel3(await res.json());
    if (!fact) return degrade("channel3 no priced offer");
    cache.set(query, { at: Date.now(), fact });
    return { ok: true, data: fact };
  });
}
