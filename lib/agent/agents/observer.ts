import { paypal } from "@/lib/paypal";
import type { Fact } from "@/lib/verdict";
import { traced } from "../trace";
import type { AgentCtx, ObserverResult } from "../types";

/**
 * The only agent that reads the network for evidence. It never decides anything:
 * it returns a Fact (observed / none) and the route hands that Fact to computeVerdict.
 */
export async function runObserver(ctx: AgentCtx, orderId: string, signal: AbortSignal): Promise<ObserverResult> {
  const res = await traced(ctx.emit, "paypal.getOrder", { orderId }, async () => {
    const r = await paypal.getOrder(orderId, { signal });
    if (!r.ok) throw new Error(`provider ${r.status}: ${r.issue}`); // throw so the panel shows red
    return r;
  });

  const approved = res.orderStatus === "APPROVED" || res.orderStatus === "COMPLETED";
  const fact: Fact = approved
    ? { kind: "observed", observedMinor: res.amountMinor, currency: res.currency }
    : { kind: "none" };

  return { fact, orderStatus: res.orderStatus, observedAtMs: ctx.nowMs };
}
