"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { PromiseState } from "@/db/schema";
import type { TraceEvent } from "@/lib/agent/types";
import { parseSse, upsertEvent } from "@/lib/sse";
import type { Verdict } from "@/lib/verdict";
import { TracePanel } from "./TracePanel";

export interface SurfaceProps {
  promise: { id: string; title: string; amountLabel: string; windowEndsAtIso: string; state: PromiseState; conditionKind: "none" | "price_at_most" | "page_contains" };
  approveUrl: string | null;
  log: { id: string; kind: string; attempt: number; createdAtIso: string }[];
  verdict: Verdict | null;
}

const TONE: Record<Verdict["kind"], string> = {
  met: "border-emerald-500 text-emerald-700",
  indeterminate: "border-amber-500 text-amber-700",
  unmet: "border-red-500 text-red-700",
};

export function PromiseSurface(props: SurfaceProps) {
  const router = useRouter();
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(props.verdict);
  const [state, setState] = useState<PromiseState>(props.promise.state);
  const [running, setRunning] = useState(false);
  const busy = useRef(false); // synchronous guard: a state flag is too slow for a fast double click

  const lastAttempt = Math.max(1, ...props.log.map((l) => l.attempt));
  const attempt = state === "declined" ? lastAttempt + 1 : lastAttempt;

  function apply(e: TraceEvent) {
    setTrace((t) => upsertEvent(t, e));
    if (e.kind === "verdict") setVerdict(e.verdict);
    if (e.kind === "done") setState(e.state);
  }

  async function settle() {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    setTrace([]);
    try {
      const res = await fetch("/api/promise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "settle", promiseId: props.promise.id, attempt }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const { events, rest } = parseSse(buf);
        buf = rest;
        events.forEach(apply);
      }
    } catch (err) {
      // stream dropped: events already shown stay; the DB is the truth, refresh recovers it
      apply({ kind: "error", id: "client", message: err instanceof Error ? err.message : "stream dropped", retryable: true });
    } finally {
      busy.current = false;
      setRunning(false);
      router.refresh();
    }
  }

  const done = state === "captured" || state === "released";

  // "Call it twice and diff": recompute the stored verdict from its stored input. No vendor is called.
  const [replay, setReplay] = useState<string | null>(null);
  async function runReplay() {
    const res = await fetch(`/api/verdict/replay?promiseId=${props.promise.id}`);
    const j = (await res.json()) as { identical?: boolean; error?: string };
    setReplay(j.error ?? (j.identical ? "Replay identical: same input, same verdict ✓" : "Replay DIFFERS ✗"));
  }

  // Degraded path: vendors down, a person types what they saw.
  const [manual, setManual] = useState("");
  const [manualMsg, setManualMsg] = useState<string | null>(null);
  async function saveManual() {
    const body =
      props.promise.conditionKind === "price_at_most"
        ? { op: "manual_fact", promiseId: props.promise.id, priceMajor: manual, inStock: true }
        : { op: "manual_fact", promiseId: props.promise.id, text: manual };
    const res = await fetch("/api/promise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json()) as { error?: string };
    setManualMsg(res.ok ? "Saved. Settle again to use it." : (j.error ?? "failed"));
  }
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <section className="min-w-0 flex-1 space-y-4">
        <header>
          <h1 className="text-xl font-semibold">{props.promise.title}</h1>
          <p className="text-sm text-neutral-500">
            {props.promise.amountLabel} · window ends {new Date(props.promise.windowEndsAtIso).toLocaleString()} · state <b>{state}</b>
          </p>
        </header>

        <div className={`min-h-20 rounded border-l-4 bg-neutral-50 p-3 ${verdict ? TONE[verdict.kind] : "border-neutral-300 text-neutral-400"}`}>
          {verdict ? (
            <>
              <div className="font-mono text-sm">{verdict.reason}</div>
              <div className="text-xs">→ {verdict.consequence} · committed {verdict.diag.committedMinor} · observed {verdict.diag.observedMinor ?? "none"} (minor units)</div>
            </>
          ) : (
            "No verdict yet."
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {props.approveUrl && !done && (
            <a href={props.approveUrl} className="rounded border border-neutral-300 px-3 py-2 text-sm">Approve in PayPal sandbox</a>
          )}
          <button onClick={settle} disabled={running || done} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {running ? "Settling…" : state === "capture_pending" ? "Check capture" : "Settle promise"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {verdict && (
            <button onClick={runReplay} className="rounded border border-neutral-300 px-2 py-1">Replay verdict</button>
          )}
          {replay && <span>{replay}</span>}
        </div>

        {props.promise.conditionKind !== "none" && !done && (
          <div className="space-y-1 text-xs">
            <p className="text-neutral-500">If the vendors are down, enter what you saw ({props.promise.conditionKind === "price_at_most" ? "the price" : "the page text"}):</p>
            <div className="flex gap-2">
              <input value={manual} onChange={(e) => setManual(e.target.value)} className="w-full rounded border border-neutral-300 px-2 py-1" />
              <button onClick={saveManual} disabled={!manual} className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-50">Save</button>
            </div>
            {manualMsg && <p>{manualMsg}</p>}
          </div>
        )}

        <div>
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Event log</h2>
          {props.log.length === 0 && <p className="text-xs text-neutral-400">No events yet.</p>}
          <ul className="text-xs">
            {props.log.map((l) => (
              <li key={l.id} className="flex gap-2 border-b border-neutral-100 py-1">
                <code className="font-mono">{l.kind}</code>
                <span className="text-neutral-400">attempt {l.attempt}</span>
                <span className="ml-auto text-neutral-400">{new Date(l.createdAtIso).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <TracePanel events={trace} />
    </div>
  );
}
