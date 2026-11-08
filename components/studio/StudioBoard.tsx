"use client";
import { AgStudioAiModule } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { useEffect, useMemo, useState } from "react";
import { widgets } from "./registry";
import { buildAi } from "./agent";
import { chatAdapter } from "./chat-adapter";

// The chat panel only appears when the AI is switched on in the browser env (the proxy also needs the server-side key).
const AI_ON = process.env.NEXT_PUBLIC_STUDIO_AI === "1";
const MODEL = process.env.NEXT_PUBLIC_STUDIO_MODEL ?? "claude-haiku-4-5";

export function StudioBoard() {
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [ppal, setPpal] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/studio/query?limit=200")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`query ${r.status}`))))
      .then((d: unknown[]) => live && setRows(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "failed"));
    // PayPal activity is a bonus source: any failure degrades to an empty array, never an error state.
    fetch("/api/studio/paypal")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: unknown) => live && setPpal(Array.isArray(d) ? d : []))
      .catch(() => live && setPpal([]));
    return () => {
      live = false;
    };
  }, []);

  const ai = useMemo(() => (AI_ON ? buildAi(chatAdapter({ endpoint: "/api/studio/llm", model: MODEL })) : undefined), []);
  const data = useMemo(() => ({ sources: [{ id: "verdicts", data: rows ?? [] }, { id: "paypal", data: ppal }] }), [rows, ppal]);

  if (error) return <p className="p-4 text-red-600">Could not load verdicts: {error}</p>;
  if (!rows) return <p className="p-4 text-neutral-500">Loading…</p>;
  return (
    <AgStudioProvider licenseKey={process.env.NEXT_PUBLIC_AG_STUDIO_KEY ?? ""} modules={[AgStudioAiModule]}>
      <div className="h-[calc(100vh-3.5rem)] w-full">
        <AgStudio data={data} widgets={widgets} mode="edit" ai={ai} />
      </div>
    </AgStudioProvider>
  );
}
