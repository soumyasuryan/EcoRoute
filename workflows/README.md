# EcoRoute Background AQI Simulator Workflow

This workflow simulates dynamic winter Air Quality Index (AQI) fluctuations and winter smog spikes across Delhi NCR neighborhoods in Neo4j AuraDB, independent of the Next.js frontend application.

It is completely free to run and does not require paid platforms like Render Workflows.

---

## What the Simulator Does

Each iteration:
1. Connects to Neo4j AuraDB using `neo4j-driver` (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`).
2. Fetches all non-warehouse neighborhood nodes.
3. Randomly selects 1–2 neighborhoods.
4. Updates their AQI values:
   - **Normal run (~75% of runs)**: Updates to moderate/poor winter AQI between **100 and 250**.
   - **Spike run (~25% / 1 in 4 runs)**: Simulates a severe winter smog spike between **350 and 500** to trigger rerouting events.
5. Commits changes to the live graph database with formatted timestamped logs.

---

## Option 1: Local Background Daemon (Recommended for Dev & Demos)

You can run the simulator as a background daemon on your machine while developing or presenting demos.

```bash
cd workflows
npm install

# Start continuous daemon (runs every 60s by default):
npm start
```

### Customizing the Interval
You can set `INTERVAL_SECONDS` to any frequency:
```bash
# In PowerShell:
$env:INTERVAL_SECONDS="30"; npm start

# In Bash / Mac / Linux:
INTERVAL_SECONDS=30 npm start
```

### Single-Shot Execution
To execute a single update and exit immediately:
```bash
npm run once
```

Example Output:
```text
======================================================
🌱 EcoRoute Background AQI Simulator Daemon Started
⚡ Connected to: neo4j+s://0b15a9dc.databases.neo4j.io
⏱️ Interval: Every 60 seconds
Press Ctrl+C at any time to gracefully stop.
======================================================

------------------------------------------------------
[AQI Workflow] Iteration at 1:09:31 pm (2026-09-19T07:39:30.253Z)
[AQI Workflow] Status: 🍃 NORMAL AQI FLUCTUATION
  📍 Greater Kailash      AQI 119 ➔ 169 ✅ [MODERATE]
[AQI Workflow] Successfully committed to Neo4j AuraDB.
------------------------------------------------------
```

---

## Option 2: 100% Free Cloud Automation (GitHub Actions)

A GitHub Actions workflow is provided at [`.github/workflows/aqi-simulator.yml`](../.github/workflows/aqi-simulator.yml) which runs automatically in the cloud on a recurring schedule with zero server costs:

1. In your GitHub repository (`soumyasuryan/EcoRoute`), go to **Settings** > **Secrets and variables** > **Actions**.
2. Add three repository secrets:
   - `NEO4J_URI`: `neo4j+s://0b15a9dc.databases.neo4j.io`
   - `NEO4J_USER`: `0b15a9dc` (or your Neo4j username)
   - `NEO4J_PASSWORD`: `<your-neo4j-password>`
3. The workflow will automatically run every 10 minutes, or you can trigger it on demand anytime under the **Actions** tab by clicking **Run workflow**.

---

## Confirming it's Working

1. **Terminal Logs**: The daemon outputs live before/after values and color-coded status badges for each updated hub.
2. **Neo4j Aura Console**:
   Run this Cypher query in the [Neo4j Aura Console](https://console.neo4j.io):
   ```cypher
   MATCH (n:Neighborhood)
   RETURN n.name AS Neighborhood, n.aqi AS AQI, ('Warehouse' IN labels(n)) AS isWarehouse
   ORDER BY n.aqi DESC;
   ```
3. **EcoRoute Dashboard**:
   Open [http://localhost:3000](http://localhost:3000). As AQI values change in the background, clicking **Recalculate Route** or refreshing the page will display updated marker colors, smog alert badges, and altered route paths!
