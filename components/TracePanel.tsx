"use client";
import type { TraceEvent } from "@/lib/agent/types";

const DOT: Record<string, string> = {
  running: "animate-pulse bg-amber-400",
  pending: "bg-neutral-300",
  skipped: "bg-neutral-300",
  ok: "bg-emerald-500",
  settled: "bg-emerald-500",
  streaming: "animate-pulse bg-amber-400",
  error: "bg-red-500",
};
const Dot = ({ s }: { s: string }) => <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[s] ?? "bg-neutral-300"}`} />;
const row = "flex min-h-7 items-center gap-2 border-b border-neutral-100 px-2 py-1 text-xs"; // fixed min height: no layout shift

/** One switch, one row per event. Errors render INLINE, never as a toast or alert. */
function Row({ e }: { e: TraceEvent }) {
  switch (e.kind) {
    case "tool":
      return (
        <div className={row}>
          <Dot s={e.state} />
          <code className="font-mono">{e.name}</code>
          <span className="truncate text-neutral-400">{JSON.stringify(e.args)}</span>
          {e.error && <span className="text-red-600">{e.error}</span>}
          <span className="ml-auto tabular-nums text-neutral-400">{e.ms !== undefined ? `${e.ms}ms` : ""}</span>
        </div>
      );
    case "subagent":
      return (
        <div className={`${row} rounded bg-neutral-50`}>
          <Dot s={e.state} />
          <span className="rounded bg-neutral-200 px-1 font-mono">{e.agent}</span>
          <span>{e.title}</span>
          <span className="ml-auto tabular-nums text-neutral-400">{e.ms !== undefined ? `${e.ms}ms` : ""}</span>
        </div>
      );
    case "diff":
      return (
        <details className="border-b border-neutral-100 px-2 py-1 text-xs" open={e.state === "streaming"}>
          <summary className="flex cursor-pointer items-center gap-2">
            <Dot s={e.state} />
            <code className="font-mono">{e.path}</code>
            {e.adds !== undefined && <span className="ml-auto text-emerald-600">+{e.adds} −{e.removes ?? 0}</span>}
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto font-mono text-[11px] leading-4">{e.hunks.join("\n")}</pre>
        </details>
      );
    case "thought":
      return <div className={`${row} italic text-neutral-400`}><span className="line-clamp-3">{e.text}</span></div>;
    case "verdict":
      return <div className={row}><Dot s="ok" /><span>verdict</span><code className="font-mono">{e.verdict.reason}</code></div>;
    case "done":
      return <div className={row}><Dot s="ok" /><span>done → {e.state}{e.deduped ? " (duplicate request, first result returned)" : ""}</span></div>;
    case "error":
      return <div className={`${row} text-red-600`}><Dot s="error" />{e.message}</div>;
  }
}

export function TracePanel({ events }: { events: TraceEvent[] }) {
  return (
    <aside className="w-full max-w-[380px] shrink-0 rounded border border-neutral-200">
      <h2 className="border-b border-neutral-200 px-2 py-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Trace</h2>
      {events.length === 0 && <p className="px-2 py-3 text-xs text-neutral-400">Nothing yet. Settle the promise to watch it run.</p>}
      {events.map((e) => (
        <Row key={e.id} e={e} />
      ))}
    </aside>
  );
}
