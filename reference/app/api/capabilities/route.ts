import { capabilityReport } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

/** Which vendors are on right now, and what happens when each is off. Shown on the home page and in Postman. */
export function GET(): Response {
  return Response.json(capabilityReport());
}
