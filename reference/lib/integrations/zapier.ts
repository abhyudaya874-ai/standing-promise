import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getEnv } from "@/lib/env";
import { degrade, guard, isOn } from "./registry";
import type { AdapterResult, NudgeInput } from "./types";

const DEFAULT_ENDPOINT = "https://mcp.zapier.com/api/v1/connect"; // Streamable HTTP. Bearer token, or a full per-server URL in ZAPIER_MCP_URL

/** Pure. Friendly register, never a collections voice. Unit-tested. */
export function buildNudge(n: NudgeInput): { subject: string; body: string } {
  const when = n.daysLate <= 0 ? "just passed" : `passed ${n.daysLate} day${n.daysLate === 1 ? "" : "s"} ago`;
  return {
    subject: "A gentle heads-up on your promise",
    body:
      `Hey ${n.payerName}, just a heads-up! The date on your promise of ${n.amountLabel} (${n.promiseId.slice(0, 8)}) ${when}. ` +
      `No rush and no pressure, we just wanted to keep you in the loop. You can pick it back up whenever suits you.`,
  };
}

/**
 * Pure. Builds the tool arguments from the tool's OWN input schema, so this works whatever your Zapier action calls its fields.
 *  - Every Zapier tool accepts `instructions` (natural language that Zapier's AI turns into the action's fields) and `output_hint`.
 *    We always put the full recipient + subject + body into `instructions`, which is enough on its own.
 *  - Structured fields (`to`, `subject`, `body`, ...) are added ONLY if the schema declares them, because extra keys can fail validation.
 */
export function buildToolArgs(schemaProps: string[], n: NudgeInput): Record<string, unknown> {
  const { subject, body } = buildNudge(n);
  const has = (k: string) => schemaProps.includes(k);
  const args: Record<string, unknown> = {};
  args.instructions = `Send an email to ${n.payerEmail} with the subject "${subject}" and this exact body: ${body}`;
  if (has("output_hint")) args.output_hint = "whether the email was sent";
  if (has("to")) args.to = n.payerEmail;
  if (has("subject")) args.subject = subject;
  if (has("body")) args.body = body;
  return args;
}

/** Pure. Zapier answers with a `followUpQuestion` when it needs more information: that is NOT a send. */
export function needsFollowUp(resultText: string): boolean {
  return /followUpQuestion/i.test(resultText);
}

/**
 * One MCP session over Streamable HTTP: initialise, find our tool, call it, close. The MCP SDK does the handshake
 * (a raw single JSON-RPC POST would NOT work). If ZAPIER_NUDGE_TOOL is not exposed we degrade with the list of
 * tools that ARE exposed, so the trace row tells you the exact name to set.
 */
export async function sendNudge(n: NudgeInput): Promise<AdapterResult<{ sent: true }>> {
  if (!isOn("zapier")) return degrade("zapier off");
  return guard("zapier", async () => {
    const env = getEnv();
    const client = new Client({ name: "standing-promise", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(env.ZAPIER_MCP_URL ?? DEFAULT_ENDPOINT), {
      requestInit: env.ZAPIER_MCP_TOKEN ? { headers: { Authorization: `Bearer ${env.ZAPIER_MCP_TOKEN}` } } : undefined,
    });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === env.ZAPIER_NUDGE_TOOL);
      if (!tool) return degrade(`zapier tool "${env.ZAPIER_NUDGE_TOOL}" not exposed; available: ${tools.map((t) => t.name).join(", ") || "none"}`);

      const props = Object.keys((tool.inputSchema.properties ?? {}) as Record<string, unknown>);
      const res = await client.callTool({ name: tool.name, arguments: buildToolArgs(props, n) }, undefined, { timeout: 8_000 });
      if (res.isError) return degrade("zapier tool reported an error");
      const text = JSON.stringify(res.content ?? "");
      if (needsFollowUp(text)) return degrade("zapier needs more information (followUpQuestion); make the action's fields fixed in the Zapier dashboard");
      return { ok: true, data: { sent: true } };
    } finally {
      await client.close().catch(() => undefined);
    }
  });
}
