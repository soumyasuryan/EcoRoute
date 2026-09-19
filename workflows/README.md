# EcoRoute Background AQI Simulator (Render Workflows)

This directory contains a background task built with the **Render Workflows TypeScript SDK** (`@renderinc/sdk`) that periodically simulates dynamic winter Air Quality Index (AQI) fluctuations and smog spikes across Delhi NCR neighborhoods in Neo4j AuraDB, independent of the Next.js frontend application.

---

## Architecture & Task Logic

- **Task Definition (`aqi-simulator.ts`)**:
  - Registered as a Render Workflow task using `@renderinc/sdk/workflows`: `task({ name: 'aqi-simulator', plan: 'starter', timeoutSeconds: 120, retry: { maxRetries: 3 } }, ...)`.
  - Directly queries Neo4j AuraDB for all non-warehouse neighborhood nodes (`MATCH (n:Neighborhood) WHERE NOT 'Warehouse' IN labels(n) ...`).
  - Randomly selects 1–2 neighborhoods.
  - Sets their AQI:
    - **Normal run (~75% of runs)**: Updates to moderate/poor winter AQI between **100 and 250**.
    - **Spike run (~25% of runs / 1 in 4)**: Simulates a severe winter smog spike between **350 and 500** to trigger dynamic rerouting events.
  - Emits formatted telemetry logs for visibility in Render's workflow logs.

---

## Scheduling Mechanism in Render Workflows

> [!NOTE]
> **Render Workflows (Public Beta)** executes distributed, durable, stateful tasks that provision and scale compute dynamically. 
> Unlike standalone cron daemons, Render Workflows does not expose an in-file cron expression syntax inside `task(...)`. Instead, recurring tasks are scheduled through one of two official Render mechanisms:
>
> 1. **Render Cron Job (Recommended)**: A companion lightweight Cron Job service configured on a cron cadence (e.g. `*/2 * * * *` for every 2 minutes) that invokes the task runner (`npm run trigger` or `npx tsx trigger.ts`).
> 2. **Render Workflows Run API**: An external scheduler (e.g. GitHub Actions or HTTP cron webhook) calling `POST https://api.render.com/v1/workflows/tasks/{taskSlug}/runs` with a `RENDER_API_KEY`.

---

## Local Development & Testing

You can run the simulation locally using `tsx`:

```bash
cd workflows
npm install

# Run the task directly:
npm start

# Or test the trigger script:
npm run trigger
```

Example output:
```text
======================================================
[Render Workflow: aqi-simulator] Run started at 2026-09-19T07:08:52.144Z
======================================================
[Render Workflow: aqi-simulator] Mode: 🍃 NORMAL AQI FLUCTUATION
[Render Workflow: aqi-simulator] 📍 Chandni Chowk: AQI 176 ➔ 243 ✅ [MODERATE]
[Render Workflow: aqi-simulator] 📍 Rohini: AQI 218 ➔ 207 ✅ [MODERATE]
[Render Workflow: aqi-simulator] Completed successfully. Updated 2 neighborhood(s).
```

---

## Deployment on Render

### Option A: Using the Render Dashboard

1. **Create a Workflow Service**:
   - Go to the [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Workflow**.
   - Connect your GitHub repository (`EcoRoute`).
   - Set **Root Directory** to `workflows`.
   - Set **Build Command** to `npm install`.
   - Set **Start Command** to `npm start`.
   - Under **Environment Variables**, add:
     - `NEO4J_URI`: `neo4j+s://<your-instance>.databases.neo4j.io`
     - `NEO4J_USER`: `0b15a9dc` (or `neo4j`)
     - `NEO4J_PASSWORD`: `<your-neo4j-password>`

2. **Set up the Recurring Schedule (Every 2 Minutes)**:
   - In the Render Dashboard, click **New +** > **Cron Job**.
   - Connect the same repository with **Root Directory** set to `workflows`.
   - Set **Schedule** to `*/2 * * * *` (runs every 2 minutes).
   - Set **Build Command** to `npm install`.
   - Set **Command** to `npm run trigger`.
   - Add the same `NEO4J_*` environment variables (and optionally `RENDER_API_KEY`).

### Option B: Deploying with `render.yaml` Blueprint

The included [`workflows/render.yaml`](file:///c:/Users/SOUMYA%20SURYAN/Desktop/All%20Projects/IgniteRoom/EcoRoute/workflows/render.yaml) automatically provisions both the workflow service and the recurring cron trigger:

1. In Render Dashboard, click **Blueprints** > **New Blueprint Instance**.
2. Select the `EcoRoute` repository.
3. Render will detect the `render.yaml` configuration and prompt for your `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` environment secrets.

---

## Confirming it's Running

1. **Render Workflow Logs**:
   - Open your workflow service or cron job in the Render Dashboard.
   - Click on the **Logs** or **Task Runs** tab. You will see formatted logs displaying each run's timestamp, mode (normal vs spike), and which neighborhoods had their AQI updated.

2. **Neo4j Aura Console Verification**:
   - Log in to your [Neo4j Aura Console](https://console.neo4j.io) and open the **Query / Neo4j Browser**.
   - Run the following Cypher query:
     ```cypher
     MATCH (n:Neighborhood)
     RETURN n.name AS Neighborhood, n.aqi AS AQI, ('Warehouse' IN labels(n)) AS isWarehouse
     ORDER BY n.aqi DESC;
     ```
   - Re-run the query every 2 minutes to observe the values continuously updating.

3. **EcoRoute Dashboard**:
   - Reload or inspect your EcoRoute web dashboard ([http://localhost:3000](http://localhost:3000)). The color-coded CircleMarkers, winter smog alerts panel, and calculated routes will reflect the background updates automatically!
