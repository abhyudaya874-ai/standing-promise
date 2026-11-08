"use client";
import type { AgWidgetData, AgWidgetDataFormat, AgWidgetField, AgWidgetParams } from "ag-studio";
import { AgLoadingOverlay } from "ag-studio-react";
import { useEffect, useState } from "react";
import { stillToComeCopy } from "./still-to-come-copy";

const KEYS = ["customer", "amountMinor", "currency", "status", "dueAt"] as const;
type Map = Record<(typeof KEYS)[number], AgWidgetField[]>;
type Data = AgWidgetData<Map, AgWidgetDataFormat<unknown>>;

/** "Still to come": invoices waiting on payment, in the friendly register. Empty is a good state, not an error. */
export function StillToCome({ dataMapping, widgetApi }: AgWidgetParams<Data>) {
  const [state, setState] = useState<{ loading: boolean; copy: ReturnType<typeof stillToComeCopy> }>({
    loading: true,
    copy: stillToComeCopy([]),
  });

  const fields = KEYS.map((k) => dataMapping[k]?.at(0));
  const ready = fields.every((f): f is AgWidgetField => !!f);
  const sig = fields.map((f) => f?.key ?? "-").join("|"); // stable dep: re-run only when the mapping itself changes

  useEffect(() => {
    const fs = KEYS.map((k) => dataMapping[k]?.at(0)).filter((f): f is AgWidgetField => !!f);
    if (fs.length < KEYS.length) return setState({ loading: false, copy: stillToComeCopy([]) });
    let live = true;
    widgetApi
      .getData({ fields: fs, limit: { count: 100 } })
      .then((res: { results: { rows: Record<string, unknown>[] } }) => {
        if (!live) return;
        const rows = res.results.rows.map((r) => ({
          customer: String(r[fs[0].key] ?? ""),
          amountMinor: Number(r[fs[1].key] ?? 0),
          currency: String(r[fs[2].key] ?? "USD"),
          status: String(r[fs[3].key] ?? ""),
          dueAt: r[fs[4].key] == null ? null : String(r[fs[4].key]),
        }));
        setState({ loading: false, copy: stillToComeCopy(rows) });
      })
      .catch(() => live && setState({ loading: false, copy: stillToComeCopy([]) }));
    return () => {
      live = false;
    };
  }, [sig, widgetApi]);

  if (state.loading) return <AgLoadingOverlay />;
  return (
    <div className="flex h-full flex-col gap-1 overflow-auto p-2">
      <div className="text-xs uppercase tracking-wide opacity-60">{state.copy.title}</div>
      {state.copy.items.length === 0 ? (
        <div className="text-sm opacity-70">{state.copy.empty}</div>
      ) : (
        <ul className="space-y-1">
          {state.copy.items.map((i, n) => (
            <li key={n} className="rounded bg-white/5 px-2 py-1 text-sm">
              <div className="font-medium">{i.label}</div>
              <div className="text-xs opacity-60">{i.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
