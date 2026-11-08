import { startSweep } from "@/lib/integrations/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts the durable sweep on Render Workflows. Degrades to a clear 503 when the capability is off. */
export async function POST(): Promise<Response> {
  const r = await startSweep();
  return r.ok ? Response.json(r.data) : Response.json({ degraded: true, reason: r.reason }, { status: 503 });
}
