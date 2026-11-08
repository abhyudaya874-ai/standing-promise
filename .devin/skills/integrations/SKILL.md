---
name: integrations
description: Add, repair or debug one sponsor adapter (Channel3, KERNEL, Elastic, Bryntum, Astropods, Zapier, Render, AG Studio) without touching the verdict
argument-hint: "<vendor>"
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - exec
triggers:
  - user
  - model
---

Vendor: $ARGUMENTS. Read `.devin/rules/80-integrations.md` and `docs/INTEGRATIONS.md` first, then run
`.devin/workflows/integration-wire.md`. The per-vendor walkthroughs are the `wire-*` workflows.

## Quick facts (verified against the docs this pack was built from; re-check if a call 4xx's)

| Vendor | Verified facts |
|---|---|
| Channel3 | `POST https://api.trychannel3.com/v1/search`, header **`x-api-key`**, body `{query, limit}`; products carry `offers[]` with `price` (number, major units), `currency`, `availability` ("InStock"), `url`, `merchant_domain` |
| KERNEL | SDK `@onkernel/sdk`: `browsers.create({headless,timeout_seconds})`, `browsers.playwright.execute(id,{code,timeout_sec})`, `browsers.replays.start/stop(replayId,{id_or_name})`, `browsers.deleteByID(id)` |
| Zapier MCP | Streamable HTTP at `https://mcp.zapier.com/api/v1/connect` (Bearer) or a per-server URL; use `@modelcontextprotocol/sdk` Client (initialize handshake). Every tool accepts `instructions` (+ `output_hint`); `followUpQuestion` in a reply means NOT done. `buildToolArgs` reads the tool's own schema |
| Render | `@renderinc/sdk`: `new Render().workflows.startTask("<workflow-slug>/<task>", args)`; tasks via `task({name}, fn)` from `@renderinc/sdk/workflows`; `ctx.run(otherTask, ...args)` chains. **Blueprints (render.yaml) do not support Workflows** |
| AG Studio | `ag-studio` + `ag-studio-react`; `AgStudioProvider licenseKey modules`, `AgStudio data widgets mode ai`; custom widgets need `id,label,comp,dataMapping,form,defaultSize,minSize`; tools via `api.defineAiTool({name,description,params,execute})`; LLM via our `chatAdapter` (chat completions) |
| Bryntum | `npm i @bryntum/scheduler@npm:@bryntum/scheduler-trial @bryntum/scheduler-react`; client-only (`next/dynamic` `ssr:false`) |
| Elastic | Jina via `PUT _inference/text_embedding/eis-jina-embeddings-v3 {service:"elastic",…}`; `semantic_text` field; hybrid = RRF retriever (`match` + `semantic`); ES\|QL = `POST /_query` |
| Astropods | `spec: blueprint/v1`; CLI `ast login / spec validate / blueprint push / blueprint deploy / agent list`; a deployed agent is a human-facing web/Slack agent (sign-in), `frontend` agents listen on **port 80**; model via the AI Gateway: `${ASTRO_GATEWAY_URL}/v1/chat/completions`, Bearer `ASTRO_GATEWAY_API_KEY` (injected). **Not an API our app can call** |
| PayPal | **INR is not processable** (domestic India payments ended 2021). Payable list = `SUPPORTED_CURRENCIES` |
