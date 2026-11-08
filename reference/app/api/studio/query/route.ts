import { queryVerdictRows } from "@/lib/studio/rows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only data source for the Studio dashboard and the timeline. */
export async function GET(req: Request): Promise<Response> {
  const raw = Number(new URL(req.url).searchParams.get("limit") ?? 100);
  const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 500) : 100;
  return Response.json(await queryVerdictRows(limit));
}
