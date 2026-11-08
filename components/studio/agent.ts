import { createAiHarness, directLlmRunner, type AgAiHarnessSetup, type AgLlmAdapter, type AgStudioApi } from "ag-studio";

type StudioApi = AgStudioApi;

/**
 * Two agents: Studio's own lead agent (kept as the primary entry) plus ours, "promise-analyst",
 * which can read verdicts and replay one. Studio owns the loop; we only describe agents and tools.
 *
 * The adapter is `chatAdapter` in ./chat-adapter.ts (OpenAI-compatible chat completions through our key-safe proxy
 * at /api/studio/llm). See .devin/workflows/wire-studio-agent.md
 */
export function buildAi(adapter: AgLlmAdapter): AgAiHarnessSetup {
  return ({ api }) =>
    // The setup callback receives the core api type; createAiHarness wants the full one. Same object at runtime.
    createAiHarness(api as unknown as StudioApi, ({ builtIn }) => ({
      agents: [
        directLlmRunner({ ...builtIn.lead, adapter }),
        directLlmRunner({
          id: "promise-analyst",
          name: "Promise analyst",
          description: "Answers why a promise was captured, released or is still waiting, using stored verdicts. Never guesses a verdict.",
          adapter,
          instructions: () =>
            "You help people understand standing promises. Verdicts are COMPUTED by code and stored; you never decide or guess one. " +
            "To explain an outcome, call replay_verdict and quote the reason code and the diag numbers (all money is in minor units). " +
            "Be friendly, never a collections voice.",
          tools: () => [replayVerdictTool(api as unknown as StudioApi)],
        }),
      ],
      primary: "promise-analyst",
    }));
}

function replayVerdictTool(api: StudioApi) {
  return api.defineAiTool({
    name: "replay_verdict",
    description: "Recompute the stored verdict of one promise from its stored input and report whether it is identical.",
    params: (s) => s.object({ promiseId: s.string({ description: "The promise id (uuid)" }) }),
    execute: async ({ promiseId }, ctx) => {
      const res = await fetch(`/api/verdict/replay?promiseId=${encodeURIComponent(promiseId)}`);
      const body: unknown = await res.json();
      return res.ok ? ctx.success("Replayed the stored verdict.", body) : ctx.error("No replayable verdict for that promise.");
    },
  });
}
