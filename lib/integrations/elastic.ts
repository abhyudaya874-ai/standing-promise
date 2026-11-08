import { z } from "zod";
import { getEnv } from "@/lib/env";
import type { Condition, Verdict } from "@/lib/verdict";
import { degrade, guard, isOn } from "./registry";
import type { AdapterResult } from "./types";

export const INDEX = "promise-verdicts";
export const INFERENCE_ID = "eis-jina-embeddings-v3"; // created by scripts/elastic-setup.mjs

/** Pure. The text we embed and match on. Stable wording = better precedent matches. */
export function conditionText(c: Condition): string {
  switch (c.kind) {
    case "none":
      return "payer approval only";
    case "price_at_most":
      return `price of ${c.query} at most ${c.ceilingMinor} minor units ${c.currency}`;
    case "page_contains":
      return `page ${c.url} contains "${c.needle}"`;
  }
}

/** Pure. One line for the explainer / trace. */
export function precedentLine(rows: { reason: string }[]): string | null {
  if (rows.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return `${n} of ${rows.length} similar past promises ended ${top}`;
}

const headers = () => ({ "content-type": "application/json", authorization: `ApiKey ${getEnv().ELASTIC_API_KEY}` });
const url = (path: string) => `${getEnv().ELASTICSEARCH_URL}${path}`;

export async function indexVerdict(doc: { promiseId: string; condition: Condition; verdict: Verdict; at: string }): Promise<AdapterResult<{ id: string }>> {
  if (!isOn("elastic")) return degrade("elastic off");
  return guard("elastic", async () => {
    const res = await fetch(url(`/${INDEX}/_doc/${doc.promiseId}`), {
      method: "PUT",
      headers: headers(),
      signal: AbortSignal.timeout(3_000),
      body: JSON.stringify({
        promiseId: doc.promiseId,
        condition_text: conditionText(doc.condition),
        reason: doc.verdict.reason,
        kind: doc.verdict.kind,
        at: doc.at,
      }),
    });
    if (!res.ok) return degrade(`elastic index http ${res.status}`);
    return { ok: true, data: { id: doc.promiseId } };
  });
}

const Hits = z.object({ hits: z.object({ hits: z.array(z.object({ _source: z.object({ promiseId: z.string(), reason: z.string(), kind: z.string() }) })) }) });

/** Hybrid search: lexical `match` + semantic (Jina embeddings) fused with RRF. */
export async function findPrecedent(condition: Condition, selfId: string): Promise<AdapterResult<{ promiseId: string; reason: string; kind: string }[]>> {
  if (!isOn("elastic")) return degrade("elastic off");
  const text = conditionText(condition);
  return guard("elastic", async () => {
    const res = await fetch(url(`/${INDEX}/_search`), {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(3_000),
      body: JSON.stringify({
        size: 4,
        _source: ["promiseId", "reason", "kind"],
        retriever: {
          rrf: {
            retrievers: [
              { standard: { query: { match: { condition_text: text } } } },
              { standard: { query: { semantic: { field: "condition_embedding", query: text } } } },
            ],
          },
        },
      }),
    });
    if (!res.ok) return degrade(`elastic search http ${res.status}`);
    const parsed = Hits.safeParse(await res.json());
    if (!parsed.success) return degrade("elastic unexpected body");
    return { ok: true, data: parsed.data.hits.hits.map((h) => h._source).filter((s) => s.promiseId !== selfId).slice(0, 3) };
  });
}

/** ES|QL passthrough for the dashboard / Agent Builder demo. Query is built by us, never from user text. */
export async function esql(query: string): Promise<AdapterResult<{ columns: { name: string }[]; values: unknown[][] }>> {
  if (!isOn("elastic")) return degrade("elastic off");
  return guard("elastic", async () => {
    const res = await fetch(url("/_query?format=json"), { method: "POST", headers: headers(), body: JSON.stringify({ query }), signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return degrade(`elastic esql http ${res.status}`);
    const body = z.object({ columns: z.array(z.object({ name: z.string() })), values: z.array(z.array(z.unknown())) }).safeParse(await res.json());
    return body.success ? { ok: true, data: body.data } : degrade("elastic esql unexpected body");
  });
}
