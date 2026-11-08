---
description: Deploy to Render and add the durable sweep via Render Workflows
---

# Render

In the reference code: `render.yaml` (web service only), `workflows/index.ts` (tasks), `lib/integrations/render.ts`, `app/api/render/sweep/route.ts`, `app/api/promises/open/route.ts`.

**Important:** Render Blueprints (`render.yaml`) do **not** support Workflows. The web service deploys from the Blueprint; the workflow service is created in the dashboard.

1. Apply the $50 credit (sponsor link). New > Blueprint > this repo: creates the web service. Fill the `sync:false` env vars. After the first deploy set `APP_URL` to the `https://<service>.onrender.com` URL and redeploy. Add that URL as the PayPal return URL source (it is built from `APP_URL`).
2. Dashboard: New > **Workflow** (public beta). Same repo. Build command `npm ci`. Start command `npx tsx workflows/index.ts`. Add env `APP_URL` (the web service URL). Note the workflow's **slug**.
3. In the web service env: `RENDER_API_KEY` (account settings), `RENDER_WORKFLOW_TASK=<workflow-slug>/sweep`, `CAP_RENDER=1`.
4. The SDK starts the task server by itself when tasks are registered; `sweep` fans out one `settleOne` sub-run per due promise via `ctx.run`. Each calls `POST /api/promise`, so the route stays the only write path and idempotency still holds.
5. Trigger: `curl -X POST https://<app>/api/render/sweep` -> `{taskRunId}`; watch the run in the dashboard. Close the browser mid-run: it still finishes (that is the "durable" claim).
6. Optional: a Render Cron Job that curls the sweep route every few minutes.
7. Degraded: `CAP_RENDER=0` -> the sweep route returns 503 `degraded`; users settle in-request as before.

Re-check https://render.com/docs/workflows-sdk-typescript if `startTask` or `task()` options differ; this API is in beta.
