// Render Workflow service entry. Deployed as a SEPARATE Render service of type "Workflow" (NOT in render.yaml:
// Blueprints do not support workflows). Start command: `npx tsx workflows/index.ts`. Env: APP_URL (the web service URL).
// The SDK starts the task server by itself once the tasks below are registered.
//
// Design rule: tasks never write to the DB directly. They call OUR single write endpoint, POST /api/promise,
// so every settle goes through validate -> compute -> persist -> capture exactly like a browser click does.
import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { parseSse } from "../lib/sse";

const APP_URL = process.env.APP_URL ?? "";

export const settleOne = task(
  { name: "settleOne", timeoutSeconds: 120, retry: { maxRetries: 2, waitDurationMs: 2_000, backoffScaling: 2 } },
  async function settleOne(_ctx: TaskContext, promiseId: string, attempt: number): Promise<{ promiseId: string; state: string; deduped: boolean }> {
    const res = await fetch(`${APP_URL}/api/promise`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "settle", promiseId, attempt }),
    });
    if (!res.ok || !res.body) throw new Error(`settle ${promiseId}: http ${res.status}`);

    // Drain the SSE stream to the end. The final "done" event carries the outcome. Idempotent on the server,
    // so a retried task can never double-capture.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let state = "unknown";
    let deduped = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parsed = parseSse(buf);
      buf = parsed.rest;
      for (const e of parsed.events) {
        if (e.kind === "done") ({ state, deduped } = e);
        if (e.kind === "error") throw new Error(`settle ${promiseId}: ${e.message}`);
      }
    }
    return { promiseId, state, deduped };
  },
);

/** One task fans out one sub-run per open promise whose window has closed. Each runs on its own compute. */
export const sweep = task({ name: "sweep", timeoutSeconds: 600 }, async function sweep(ctx: TaskContext) {
  const res = await fetch(`${APP_URL}/api/promises/open`);
  if (!res.ok) throw new Error(`open list: http ${res.status}`);
  const open = (await res.json()) as { id: string; windowEndsAt: string }[];
  const due = open.filter((p) => new Date(p.windowEndsAt).getTime() <= Date.now());
  const results = await Promise.all(due.map((p) => ctx.run(settleOne, p.id, 1)));
  return { checked: open.length, settled: results.length, results };
});
