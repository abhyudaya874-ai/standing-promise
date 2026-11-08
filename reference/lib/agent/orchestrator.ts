import { Budget, withTimeout } from "./budget";
import { PROFILES } from "./registry";
import { nextId } from "./trace";
import { runArchivist } from "./agents/archivist";
import { runExplainer } from "./agents/explainer";
import { runGuard } from "./agents/guard";
import { runNudger } from "./agents/nudger";
import { runObserver } from "./agents/observer";
import { runResolver } from "./agents/resolver";
import { runReconciler } from "./agents/reconciler";
import type { AgentCtx, Gathered, GuardFacts, SubagentId, SubagentResult } from "./types";
import type { ConditionFact, Fact, Verdict } from "@/lib/verdict";

export class CycleError extends Error {
  constructor(public stage: SubagentId, message: string, public retryable = false) {
    super(message);
  }
}

const msgOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Fixed graph, no model chooses the shape. The ROUTE sits between the two phases:
 *   gather()  -> guard, observer, reconciler          (facts in)
 *   route     -> computeVerdict (pure) -> persist -> capture
 *   decorate() -> explainer, archivist                 (prose + summary, best-effort)
 */
export class Cycle {
  private readonly budget = new Budget();
  constructor(private readonly ctx: AgentCtx) {}

  /** One subagent run: emits a card, enforces the cap, retries per profile. Never throws. */
  private async run<T>(id: SubagentId, fn: (signal: AbortSignal) => Promise<T>): Promise<SubagentResult<T>> {
    const p = PROFILES[id];
    const eid = nextId(id);
    const t0 = Date.now();
    this.ctx.emit({ kind: "subagent", id: eid, agent: id, title: p.title, state: "running" });

    let lastErr = "unknown";
    for (let i = 0; i <= p.retries; i++) {
      try {
        const data = await withTimeout(p, this.budget, this.ctx.signal, fn);
        const ms = Date.now() - t0;
        this.ctx.emit({ kind: "subagent", id: eid, agent: id, title: p.title, state: "ok", ms });
        return { ok: true, agent: id, ms, data };
      } catch (err) {
        lastErr = msgOf(err);
        if (this.ctx.signal.aborted || this.budget.exhausted) break;
      }
    }
    const ms = Date.now() - t0;
    this.ctx.emit({ kind: "subagent", id: eid, agent: id, title: p.title, state: "error", ms });
    return { ok: false, agent: id, ms, error: lastErr, retryable: p.retries > 0 };
  }

  async gather(): Promise<Gathered> {
    const { ctx } = this;

    const guard = await this.run("guard", (s) => runGuard(ctx, s));
    if (!guard.ok) throw new CycleError("guard", guard.error); // onFailure: abort

    // onFailure: degrade. Blind observer => Fact "unavailable" => verdict FACT_MISSING => WAIT. Never RELEASE.
    const obs = await this.run("observer", (s) => runObserver(ctx, guard.data.orderId, s));
    let fact: Fact = { kind: "unavailable" };
    let orderStatus: string | null = null;
    if (obs.ok) {
      fact = obs.data.fact;
      orderStatus = obs.data.orderStatus;
    } else {
      ctx.emit({ kind: "thought", id: nextId("note"), text: `Observer unavailable (${obs.error}). Verdict will be FACT_MISSING; nothing is captured.` });
    }

    // onFailure: degrade. Vendors down -> manual snapshot -> {kind:"unavailable"} -> FACT_MISSING -> WAIT.
    const res = await this.run("resolver", (s) => runResolver(ctx, guard.data, s));
    let world: ConditionFact = guard.data.terms.condition.kind === "none" ? { kind: "not_checked" } : { kind: "unavailable" };
    if (res.ok) {
      world = res.data.world;
      for (const d of res.data.degradedFrom) ctx.emit({ kind: "thought", id: nextId("note"), text: `Degraded: ${d}` });
    } else {
      ctx.emit({ kind: "thought", id: nextId("note"), text: `Resolver unavailable (${res.error}). Condition treated as unknown; nothing is captured.` });
    }

    // onFailure: ignore
    const rec = await this.run("reconciler", (s) => runReconciler(ctx, orderStatus, s));
    if (rec.ok && rec.data.drift) ctx.emit({ kind: "thought", id: nextId("note"), text: `Drift: ${rec.data.note}` });

    return { guard: guard.data, fact, world, reconciliation: rec.ok ? rec.data : null };
  }

  /** Best-effort. Awaited so the stream stays open, but a failure here changes nothing upstream. */
  async decorate(verdict: Verdict, guard: GuardFacts): Promise<void> {
    const { ctx } = this;
    const [explain, nudge] = await Promise.all([
      this.run("explainer", (s) => runExplainer(ctx, s, verdict, guard.terms.condition)),
      this.run("nudger", (s) => runNudger(ctx, guard, verdict, s)),
      this.run("archivist", (s) => runArchivist(ctx, s, verdict, guard.terms.condition)),
    ]);
    if (explain.ok) ctx.emit({ kind: "thought", id: nextId("explain"), text: explain.data });
    if (nudge.ok && nudge.data.banner) ctx.emit({ kind: "thought", id: nextId("banner"), text: nudge.data.banner });
  }
}
