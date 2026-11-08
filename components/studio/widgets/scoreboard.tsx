"use client";
import type { AgWidgetData, AgWidgetDataFormat, AgWidgetField, AgWidgetParams } from "ag-studio";
import { AgLoadingOverlay, AgNoDataOverlay } from "ag-studio-react";
import { useEffect, useState } from "react";

const FACE: Record<string, string> = { met: "🟢", indeterminate: "🟡", unmet: "🔴" };

type Data = AgWidgetData<{ payer: AgWidgetField[]; kind: AgWidgetField[] }, AgWidgetDataFormat<unknown>>;

/** A friendly scoreboard, not a collections report: who is on track, who is waiting, who missed it. */
export function Scoreboard({ dataMapping, widgetApi }: AgWidgetParams<Data>) {
  const payer = dataMapping.payer?.at(0);
  const kind = dataMapping.kind?.at(0);
  const [rows, setRows] = useState<{ payer: string; kind: string }[] | null>(null);

  useEffect(() => {
    if (!payer || !kind) return setRows([]);
    let live = true;
    widgetApi
      .getData({ fields: [payer, kind] })
      .then((res: { results: { rows: Record<string, unknown>[] } }) => {
        if (live) setRows(res.results.rows.map((r) => ({ payer: String(r[payer.key]), kind: String(r[kind.key]) })));
      })
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [payer, kind, widgetApi]);

  if (!rows) return <AgLoadingOverlay />;
  if (rows.length === 0) return <AgNoDataOverlay />;
  return (
    <ul className="h-full space-y-1 overflow-auto p-2 text-sm">
      {rows.map((r, i) => (
        <li key={`${r.payer}-${i}`} className="flex items-center justify-between rounded bg-white/5 px-2 py-1">
          <span>{r.payer}</span>
          <span>{FACE[r.kind] ?? "⚪"} {r.kind === "met" ? "on track" : r.kind === "unmet" ? "missed it" : "waiting"}</span>
        </li>
      ))}
    </ul>
  );
}
