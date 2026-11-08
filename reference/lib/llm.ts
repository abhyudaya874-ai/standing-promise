import { getEnv } from "@/lib/env";

const MODEL = "claude-haiku-5-5";

/** Optional. The app must work with no key: callers fall back to templates. */
export const llm = {
  configured(): boolean {
    return Boolean(getEnv().ANTHROPIC_API_KEY);
  },

  async complete(prompt: string, o: { signal: AbortSignal; maxTokens: number }): Promise<string> {
    const key = getEnv().ANTHROPIC_API_KEY;
    if (!key) throw new Error("LLM not configured");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: o.maxTokens, messages: [{ role: "user", content: prompt }] }),
      signal: o.signal,
    });
    if (!res.ok) throw new Error(`llm ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).map((c) => (c.type === "text" ? (c.text ?? "") : "")).join("").trim();
  },
};
