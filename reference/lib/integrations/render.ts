import { Render } from "@renderinc/sdk";
import { getEnv } from "@/lib/env";
import { degrade, guard, isOn } from "./registry";
import type { AdapterResult } from "./types";

/**
 * Starts the `sweep` task on the Render Workflow service (see /workflows). Each swept promise is settled by calling
 * OUR OWN single write endpoint, so the route stays the only write path. A cycle survives the browser closing.
 * Slug format is "<workflow-service-slug>/<task-name>", set in RENDER_WORKFLOW_TASK.
 */
export async function startSweep(): Promise<AdapterResult<{ taskRunId: string }>> {
  if (!isOn("render")) return degrade("render off");
  return guard("render", async () => {
    const env = getEnv();
    const render = new Render({ token: env.RENDER_API_KEY });
    const run = await render.workflows.startTask(env.RENDER_WORKFLOW_TASK, [], AbortSignal.timeout(5_000));
    return { ok: true, data: { taskRunId: run.taskRunId } };
  });
}
