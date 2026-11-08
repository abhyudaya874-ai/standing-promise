import { logEvent } from "@/lib/events";
import { sendNudge } from "@/lib/integrations/zapier";
import { formatMajor } from "@/lib/money";
import type { Verdict } from "@/lib/verdict";
import { traced } from "../trace";
import type { AgentCtx, GuardFacts } from "../types";

const DAY_MS = 86_400_000;

/**
 * Friendly reminder when a promise ended UNMET. Best-effort: it can never change a verdict or block a capture.
 * Degraded path = an in-app banner line (returned as `banner`, shown in the trace).
 */
export async function runNudger(ctx: AgentCtx, g: GuardFacts, verdict: Verdict, signal: AbortSignal): Promise<{ sent: boolean; banner: string | null }> {
  if (verdict.kind !== "unmet") return { sent: false, banner: null };

  const amountLabel = `${formatMajor(g.terms.amountMinor, g.terms.currency)} ${g.terms.currency}`;
  const daysLate = Math.max(0, Math.floor((ctx.nowMs - g.terms.windowEndsAtMs) / DAY_MS));
  const banner = `Heads-up for ${g.payer.name}: ${amountLabel} did not come through by its date. Send a friendly nudge when ready.`;
  if (!g.payer.email) return { sent: false, banner };

  try {
    await traced(ctx.emit, "zapier.nudge", { to: g.payer.email, daysLate }, async () => {
      const r = await sendNudge({ promiseId: ctx.promiseId, payerName: g.payer.name, payerEmail: g.payer.email as string, amountLabel, daysLate });
      if (!r.ok) throw new Error(r.reason);
    });
  } catch {
    return { sent: false, banner };
  }
  if (signal.aborted) throw new Error("nudger aborted");
  await logEvent(ctx.promiseId, ctx.attempt, "nudge_sent", { to: g.payer.email });
  return { sent: true, banner: null };
}
