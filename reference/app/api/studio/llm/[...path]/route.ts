import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keeps the LLM key OFF the browser (AG Studio docs: "Keeping Keys Off the Client").
 * The Studio adapter (components/studio/chat-adapter.ts) points its `endpoint` at /api/studio/llm.
 * Only `chat/completions` is forwarded to STUDIO_LLM_BASE_URL, streaming straight back.
 * Works with any OpenAI-compatible provider (OpenAI, the Astropods AI Gateway, Anthropic's OpenAI-compatible endpoint).
 */
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const env = getEnv();
  if (!env.CAP_STUDIO || !env.STUDIO_LLM_BASE_URL || !env.STUDIO_LLM_API_KEY) {
    return Response.json({ error: "studio llm not configured" }, { status: 503 });
  }
  const { path } = await ctx.params;
  // Exactly one upstream route is allowed. Anything else is refused, so this proxy cannot be used as an open relay.
  if (path.join("/") !== "chat/completions") return Response.json({ error: "only chat/completions is proxied" }, { status: 404 });

  // Node's fetch needs `duplex: "half"` to forward a streamed request body; the DOM RequestInit type lacks it.
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.STUDIO_LLM_API_KEY}` },
    body: req.body,
    duplex: "half",
    signal: req.signal,
  };
  const upstream = await fetch(`${env.STUDIO_LLM_BASE_URL.replace(/\/$/, "")}/${path.join("/")}`, init);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-cache, no-transform" },
  });
}
