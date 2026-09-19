import { createWorkflowsClient } from '@renderinc/sdk/workflows';
import { executeAqiSimulation } from './aqi-simulator.js';

/**
 * Trigger runner for the aqi-simulator workflow task.
 *
 * Can be run via:
 * 1. Render Cron Job or external scheduler: triggers the workflow task via Render Workflows API
 * 2. Standalone fallback: directly executes simulation against Neo4j if RENDER_API_KEY is not configured
 */
async function main() {
  const apiKey = process.env.RENDER_API_KEY;
  const taskSlug = process.env.RENDER_WORKFLOW_TASK_SLUG || 'aqi-simulator';

  if (apiKey) {
    console.log(`[Workflow Trigger] Triggering Render Workflow task: "${taskSlug}" via SDK...`);
    const client = createWorkflowsClient({ token: apiKey });
    try {
      const run = await client.startTask(taskSlug, []);
      console.log(`[Workflow Trigger] Successfully triggered task run ID:`, run);
      return;
    } catch (err: any) {
      console.warn(`[Workflow Trigger] SDK startTask failed (${err.message}). Falling back to in-process execution...`);
    }
  }

  console.log('[Workflow Trigger] Running AQI simulation directly...');
  const result = await executeAqiSimulation();
  console.log('[Workflow Trigger] Simulation finished:', result);
}

main().catch((err) => {
  console.error('[Workflow Trigger] Error:', err);
  process.exit(1);
});
