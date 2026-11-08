import { activityRows } from "@/lib/integrations/paypal-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only PayPal activity feed for the Studio board. Degraded = [] plus x-degraded, never an error. */
export async function GET(): Promise<Response> {
  const r = await activityRows(AbortSignal.timeout(15_000));
  if (!r.ok) return Response.json([], { headers: { "x-degraded": r.reason } });
  return Response.json(r.data);
}
