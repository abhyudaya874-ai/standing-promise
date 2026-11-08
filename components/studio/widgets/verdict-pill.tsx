"use client";
import type { AgWidgetData, AgWidgetDataFormat, AgWidgetField, AgWidgetParams } from "ag-studio";
import { AgLoadingOverlay, AgNoDataOverlay } from "ag-studio-react";
import { useEffect, useState } from "react";

const TONE: Record<string, string> = {
  CONDITION_MET: "text-emerald-400", AMOUNT_MET: "text-emerald-400",
  CONDITION_PENDING: "text-amber-400", WINDOW_OPEN: "text-amber-400", FACT_MISSING: "text-amber-400", CURRENCY_MISMATCH: "text-amber-400",
  CONDITION_UNMET: "text-red-400", AMOUNT_SHORT: "text-red-400", WINDOW_EXPIRED: "text-red-400",
};

type Data = AgWidgetData<{ reason: AgWidgetField[] }, AgWidgetDataFormat<unknown>>;

/** Shows the reason code of the most recent verdict row. The first row is the latest (the query sorts desc). */
export function VerdictPill({ dataMapping, widgetApi }: AgWidgetParams<Data>) {
  const field = dataMapping.reason?.at(0);
  const [state, setState] = useState<{ status: "loading" | "empty" | "ready"; reason?: string }>({ status: "loading" });

  useEffect(() => {
    if (!field) return setState({ status: "empty" });
    let live = true;
    widgetApi
      .getData({ fields: [field], limit: { count: 1 } })
      .then((res: { results: { rows: Record<string, unknown>[] } }) => {
        if (!live) return;
        const v = res.results.rows[0]?.[field.key];
        setState(v ? { status: "ready", reason: String(v) } : { status: "empty" });
      })
      .catch(() => live && setState({ status: "empty" }));
    return () => {
      live = false;
    };
  }, [field, widgetApi]);

  if (state.status === "loading") return <AgLoadingOverlay />;
  if (state.status === "empty") return <AgNoDataOverlay />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <span className="text-xs uppercase tracking-wide opacity-60">Latest verdict</span>
      <span className={`text-2xl font-bold ${TONE[state.reason ?? ""] ?? ""}`}>{state.reason}</span>
    </div>
  );
}
