---
description: Zapier MCP nudge-bot: friendly email when a promise ends UNMET, in-app banner when Zapier is off
---

# Zapier nudges

In the reference code: `lib/integrations/zapier.ts` (`buildNudge` pure and tested; `sendNudge` via the MCP SDK), `agents/nudger.ts`, `scripts/zapier-tools.mjs`.

1. Create a Zapier account (14-day Pro trial). Create an MCP server, add ONE action: Gmail "Send Email" (or Slack "Send Channel Message"). Copy its token to `ZAPIER_MCP_TOKEN`.
2. Set `ZAPIER_NUDGE_TOOL` to your tool's name (default `gmail_send_email`). You do NOT need to know its argument names: the adapter reads the tool's own input schema at call time
   (`buildToolArgs`), always sends a complete natural-language `instructions` (every Zapier tool accepts it), and adds `to` / `subject` / `body` / `output_hint` only if the schema declares them.
   If the name is wrong the trace row lists the tools that ARE exposed. To see them yourself: `node scripts/zapier-tools.mjs`.
   Per-server URL instead of a token? Set `ZAPIER_MCP_URL` (and leave `ZAPIER_MCP_TOKEN` empty).
3. `CAP_ZAPIER=1`. Create a promise with a `payerEmail` that is YOUR OWN inbox and a tiny window. Let it expire, Settle: verdict UNMET -> trace row `zapier.nudge` -> the email arrives -> event `nudge_sent`.
4. Check the tone: friendly, "no rush", never "overdue / owe / penalty" (the unit test enforces the word list; keep it).
5. If Zapier answers with a `followUpQuestion` it needs more information: that is treated as NOT sent (degraded). Fix it by making the action's fields fixed in the Zapier dashboard.
6. Degraded: `CAP_ZAPIER=0` or no email on the promise: the trace shows an in-app banner line instead, and nothing throws.
7. A nudge never changes a verdict or blocks a capture. Keep it that way: it only runs in `decorate`.
