import { desc, and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { conditionSnapshot } from "@/db/schema";
import { logEvent } from "@/lib/events";
import { searchProduct } from "@/lib/integrations/channel3";
import { fetchPage, observePage } from "@/lib/integrations/kernel";
import { isOn } from "@/lib/integrations/registry";
import type { AdapterResult } from "@/lib/integrations/types";
import type { ConditionFact } from "@/lib/verdict";
import { traced } from "../trace";
import type { AgentCtx, GuardFacts, ResolverResult } from "../types";

type Source = Exclude<ResolverResult["source"], "none">;

/** The latest human-entered snapshot for this promise (the degraded path for every vendor). */
async function latestManual(promiseId: string): Promise<{ fact: ConditionFact } | null> {
  const [row] = await getDb()
    .select({ fact: conditionSnapshot.fact })
    .from(conditionSnapshot)
    .where(and(eq(conditionSnapshot.promiseId, promiseId), eq(conditionSnapshot.source, "manual")))
    .orderBy(desc(conditionSnapshot.capturedAt))
    .limit(1);
  return row ? { fact: row.fact } : null;
}

/**
 * Looks at the WORLD for the promise's condition. Vendors in, a frozen snapshot out. It never decides.
 * Chain per condition kind: vendor(s) -> manual snapshot -> {kind:"unavailable"} (verdict: FACT_MISSING -> WAIT).
 */
export async function runResolver(ctx: AgentCtx, g: GuardFacts, signal: AbortSignal): Promise<ResolverResult> {
  const cond = g.terms.condition;
  const degradedFrom: string[] = [];

  /** Run one adapter inside a trace row. A degraded result is recorded and becomes null; it never throws. */
  const attempt = async <T,>(name: string, args: Record<string, unknown>, call: () => Promise<AdapterResult<T>>): Promise<T | null> => {
    try {
      return await traced(ctx.emit, name, args, async () => {
        const r = await call();
        if (!r.ok) throw new Error(r.reason);
        return r.data;
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      degradedFrom.push(`${name}: ${reason}`);
      await logEvent(ctx.promiseId, ctx.attempt, "degraded", { capability: name, reason });
      return null;
    }
  };

  let world: ConditionFact = { kind: "unavailable" };
  let source: ResolverResult["source"] = "none";
  let evidenceUrl: string | null = null;

  switch (cond.kind) {
    case "none":
      return { world: { kind: "not_checked" }, source: "none", evidenceUrl: null, degradedFrom };

    case "price_at_most": {
      const p = await attempt("channel3.search", { query: cond.query }, () => searchProduct(cond.query, signal));
      if (p) {
        world = { kind: "product", priceMinor: p.priceMinor, currency: p.currency, inStock: p.inStock };
        source = "channel3";
        evidenceUrl = p.buyUrl || null;
        // Evidence only: a KERNEL replay of the merchant page. Failure changes nothing.
        if (p.buyUrl && isOn("kernel")) {
          const page = await attempt("kernel.observe", { url: p.buyUrl }, () => observePage(p.buyUrl, AbortSignal.timeout(4_000)));
          if (page?.replayUrl) evidenceUrl = page.replayUrl;
        }
      }
      break;
    }

    case "page_contains": {
      // kernel -> plain fetch. First one that answers wins.
      let page = isOn("kernel") ? await attempt("kernel.observe", { url: cond.url }, () => observePage(cond.url, signal)) : null;
      let src: Source = "kernel";
      if (!page) {
        page = await attempt("fetch.page", { url: cond.url }, () => fetchPage(cond.url, signal));
        src = "fetch";
      }
      if (page) {
        world = { kind: "page", text: page.text };
        source = src;
        evidenceUrl = page.replayUrl ?? null;
      }
      break;
    }
  }

  if (world.kind === "unavailable") {
    const manual = await latestManual(ctx.promiseId);
    if (manual) {
      world = manual.fact;
      source = "manual";
    }
  }
  if (signal.aborted) throw new Error("resolver aborted");

  // @invariant:snapshot-before-verdict. Freeze what we saw BEFORE the route computes the verdict.
  if (source !== "none" && source !== "manual" && world.kind !== "unavailable") {
    await getDb().insert(conditionSnapshot).values({ promiseId: ctx.promiseId, attempt: ctx.attempt, source, fact: world, evidenceUrl });
    await logEvent(ctx.promiseId, ctx.attempt, "snapshot", { source, evidenceUrl });
  }
  return { world, source, evidenceUrl, degradedFrom };
}
