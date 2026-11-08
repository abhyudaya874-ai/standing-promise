"use client";
import { useState } from "react";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

type Kind = "none" | "price_at_most" | "page_contains";

export function Composer() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("none");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return; // double-submit guard; the server is idempotent anyway
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const condition =
      kind === "price_at_most"
        ? { kind, query: s("query"), ceiling: s("ceiling") }
        : kind === "page_contains"
          ? { kind, url: s("url"), needle: s("needle") }
          : { kind };
    try {
      const res = await fetch("/api/promise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "create",
          title: s("title"),
          amount: s("amount"),
          currency: s("currency") || "USD",
          windowMinutes: Number(s("windowMinutes") || 10),
          payerName: s("payerName") || undefined,
          payerEmail: s("payerEmail") || undefined,
          condition,
        }),
      });
      const json = (await res.json()) as { promiseId?: string; error?: string };
      if (!res.ok || !json.promiseId) throw new Error(json.error ?? "could not create the promise");
      window.location.href = `/p?id=${json.promiseId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create the promise");
      setBusy(false);
    }
  }

  const input = "w-full rounded border border-neutral-300 px-3 py-2";
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="title" placeholder="What are you promising?" required className={input} />
      <div className="flex gap-3">
        <input name="amount" inputMode="decimal" placeholder="10.00" required className={input} />
        <select name="currency" defaultValue="USD" className={input}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <input name="payerName" placeholder="Payer name" className={input} />
        <input name="payerEmail" type="email" placeholder="Payer email (for a friendly nudge)" className={input} />
      </div>
      <input name="windowMinutes" type="number" min={1} defaultValue={10} className={input} aria-label="Window in minutes" />

      <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={input} aria-label="Condition">
        <option value="none">Capture as soon as the payer approves</option>
        <option value="price_at_most">…and a product price is at or below a ceiling (Channel3)</option>
        <option value="page_contains">…and a web page contains some text (KERNEL)</option>
      </select>
      {kind === "price_at_most" && (
        <p className="text-xs text-neutral-500">
          PayPal cannot process INR, so promises are in USD, EUR, GBP, CAD, AUD or JPY. Use a product sold in the same currency as the promise,
          or the verdict will wait with CURRENCY_MISMATCH.
        </p>
      )}
      {kind === "price_at_most" && (
        <div className="flex gap-3">
          <input name="query" placeholder="Product, e.g. Nike Pegasus 41" required className={input} />
          <input name="ceiling" inputMode="decimal" placeholder="Ceiling, e.g. 120.00" required className={input} />
        </div>
      )}
      {kind === "page_contains" && (
        <div className="flex gap-3">
          <input name="url" type="url" placeholder="https://…" required className={input} />
          <input name="needle" placeholder="Text that must appear" required className={input} />
        </div>
      )}

      <button disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Creating…" : "Commit promise"}
      </button>
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}
