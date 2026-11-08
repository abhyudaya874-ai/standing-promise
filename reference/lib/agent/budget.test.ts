import { describe, expect, it } from "vitest";
import { Budget, withTimeout } from "./budget";
import type { AgentProfile } from "./types";

const profile: AgentProfile = { id: "guard", title: "t", maxMs: 40, retries: 0, requiresNetwork: false, onFailure: "abort" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("withTimeout", () => {
  it("resolves fast work", async () => {
    const out = await withTimeout(profile, new Budget(), new AbortController().signal, async () => "ok");
    expect(out).toBe("ok");
  });
  it("rejects slow work even if it ignores the signal", async () => {
    await expect(
      withTimeout(profile, new Budget(), new AbortController().signal, async () => {
        await sleep(200);
        return "late";
      }),
    ).rejects.toThrow(/timed out/);
  });
  it("aborts the signal it handed out when the deadline hits", async () => {
    let seen: AbortSignal | undefined;
    await withTimeout(profile, new Budget(), new AbortController().signal, async (s) => {
      seen = s;
      await sleep(200);
    }).catch(() => undefined);
    expect(seen?.aborted).toBe(true);
  });
  it("propagates the parent abort", async () => {
    const parent = new AbortController();
    let seen: AbortSignal | undefined;
    const p = withTimeout({ ...profile, maxMs: 500 }, new Budget(), parent.signal, async (s) => {
      seen = s;
      await sleep(100);
    });
    parent.abort(new Error("client left"));
    await p.catch(() => undefined);
    expect(seen?.aborted).toBe(true);
  });
});
