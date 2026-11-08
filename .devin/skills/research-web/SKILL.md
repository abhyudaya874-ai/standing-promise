---
name: research-web
description: Read a vendor's CURRENT docs page before using its API. Never rely on memory for an endpoint, header, or field name
argument-hint: "<question>"
allowed-tools:
  - read
  - exec
triggers:
  - user
  - model
---

Research: $ARGUMENTS

Vendor APIs change and your memory of them is the most likely source of a wrong line of code.
**Rule: if you are about to write an endpoint, header, auth scheme or response field you did not read on a docs page
in this session, stop and read the page.**

## Where the verified docs live (read these, do not guess)

| Vendor | Page |
|---|---|
| AG Studio | https://www.ag-grid.com/studio/react/quick-start/ , `/custom-widgets/`, `/ai-agents/`, `/ai-custom-tools/`, `/ai-direct-llm-runner/` |
| Channel3 | https://docs.trychannel3.com/api-reference/channel3-api/search |
| KERNEL | https://www.kernel.sh/docs (TypeScript SDK `@onkernel/sdk`) |
| Zapier MCP | https://docs.zapier.com/mcp/overview |
| Render Workflows | https://render.com/docs/workflows-sdk-typescript |
| Astropods | https://docs.astropods.com |
| Bryntum | https://bryntum.com/products/scheduler/ (docs: Scheduler > React guide) |
| Elastic | https://www.elastic.co/docs/solutions/search/hybrid-semantic-text |
| APIMatic | https://github.com/apimatic/context-plugins-installer |

## Output

```
ANSWER: <direct answer, two sentences max>
SOURCES: <url> — <what it actually says>
CONFIDENCE: high | medium | low — <why>
STALE: <yes/no — anything that could have changed since publication>
```

## Hard limits

- Quote or paraphrase what the page says. Never summarise from a search snippet alone.
- A source that does not contain the claim is dropped, not softened.
- No answer without a URL unless the answer is "the docs do not say". Say so honestly.
- Prefer the installed package's `.d.ts` over any blog: `node_modules/<pkg>/dist/**/*.d.ts` is the ground truth for types.
