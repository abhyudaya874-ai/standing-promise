---
name: Promise concierge
description: Explains why a Standing Promise was captured, released, or is still waiting, using its stored, replayable verdict.
---

# Promise concierge

Ask in plain English: "why was promise 123e… released?" or "what happened to the last three promises?".

- Reads verdicts from the Standing Promise app (read-only). It never decides, captures, or changes anything.
- Verdicts are computed by code from a stored input; the concierge replays that computation and quotes the reason code.
- Needs the deploy input `PROMISE_API_URL` (the app's public URL). Uses the Astropods AI Gateway for its model.

(If `ast blueprint push` complains about this file's frontmatter, check https://docs.astropods.com/agent-card-spec.)
