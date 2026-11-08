import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Emit } from "./types";

let seq = 0;
export const nextId = (prefix: string): string => `${prefix}-${++seq}`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const msgOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Wrap ANY external call so it shows up in the trace panel: running -> ok | error.
 * Rethrows on failure. If the call returns a failure VALUE instead of throwing,
 * throw inside `fn` so the panel shows red (see observer.ts).
 */
export async function traced<T>(
  emit: Emit,
  name: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const id = nextId("tool");
  const t0 = Date.now();
  emit({ kind: "tool", id, name, args, state: "running" });
  try {
    const out = await fn();
    emit({ kind: "tool", id, name, args, state: "ok", ms: Date.now() - t0 });
    return out;
  } catch (err) {
    emit({ kind: "tool", id, name, args, state: "error", ms: Date.now() - t0, error: msgOf(err) });
    throw err;
  }
}

/**
 * Demo beat: show the REAL source of the function that just decided the verdict.
 * It reads lib/verdict.ts from disk, so nothing here is mocked. Best-effort: any failure is silent.
 */
export async function streamVerdictSource(emit: Emit): Promise<void> {
  try {
    const src = await readFile(join(process.cwd(), "lib", "verdict.ts"), "utf8");
    const lines = src.split("\n");
    const start = lines.findIndex((l) => l.startsWith("function decide"));
    if (start === -1) return;
    const end = lines.findIndex((l, i) => i > start && l === "}");
    if (end === -1) return;
    const body = lines.slice(start, end + 1);
    const id = nextId("diff");
    for (let i = 6; i < body.length + 6; i += 6) {
      emit({ kind: "diff", id, path: "lib/verdict.ts", hunks: body.slice(0, i), state: "streaming" });
      await sleep(40);
    }
    emit({ kind: "diff", id, path: "lib/verdict.ts", hunks: body, state: "settled", adds: body.length, removes: 0 });
  } catch {
    /* never block the verdict on a visual */
  }
}
