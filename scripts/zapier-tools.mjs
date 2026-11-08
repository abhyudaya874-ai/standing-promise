#!/usr/bin/env node
// Prints the tools your Zapier MCP server exposes, with their input schemas.
// Usage: ZAPIER_MCP_TOKEN=... node scripts/zapier-tools.mjs
// Then set ZAPIER_NUDGE_TOOL to the exact tool name and make lib/integrations/zapier.ts send the argument names it lists.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const token = process.env.ZAPIER_MCP_TOKEN;
if (!token) throw new Error("set ZAPIER_MCP_TOKEN");
const client = new Client({ name: "standing-promise-probe", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.zapier.com/api/v1/connect"), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
const { tools } = await client.listTools();
for (const t of tools) console.log(`\n${t.name}\n  ${t.description ?? ""}\n  input: ${JSON.stringify(t.inputSchema?.properties ?? {})}`);
await client.close();
