import { task, type TaskContext } from '@renderinc/sdk/workflows';
import neo4j, { type Driver, type Session } from 'neo4j-driver';
import fs from 'fs';
import path from 'path';

export interface UpdatedNeighborhood {
  name: string;
  previousAqi: number;
  newAqi: number;
  isSpike: boolean;
}

export interface SimulationResult {
  success: boolean;
  timestamp: string;
  isSpikeRun: boolean;
  updatedCount: number;
  updatedNeighborhoods: UpdatedNeighborhood[];
}

/**
 * Helper to load environment variables from .env.local if running locally or outside Next.js
 */
function loadEnvFallback(): void {
  if (process.env.NEO4J_URI && process.env.NEO4J_PASSWORD) return;

  const candidatePaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '../.env.local'),
    path.resolve(process.cwd(), '../../.env.local')
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valParts] = trimmed.split('=');
          if (key && valParts.length) {
            const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[key.trim()] = val;
          }
        }
      });
      break;
    }
  }
}

/**
 * Initializes a Neo4j driver using the configured environment variables
 */
function getNeo4jDriver(): Driver {
  loadEnvFallback();

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER || process.env.NEO4J_USERNAME || '0b15a9dc';
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !password) {
    throw new Error(
      'Missing Neo4j connection details. Set NEO4J_URI, NEO4J_USER (or NEO4J_USERNAME), and NEO4J_PASSWORD.'
    );
  }

  return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

/**
 * Core simulation logic:
 * 1. Fetches all non-warehouse neighborhood nodes from Neo4j
 * 2. Randomly selects 1-2 neighborhoods
 * 3. Updates their AQI:
 *    - ~75% of runs: normal winter AQI (100 - 250)
 *    - ~25% of runs (1 in 4): winter smog spike (350 - 500)
 * 4. Logs before/after values with timestamps for visibility in Render Workflow logs
 */
export async function executeAqiSimulation(): Promise<SimulationResult> {
  const driver = getNeo4jDriver();
  const session: Session = driver.session();
  const timestamp = new Date().toISOString();

  console.log(`\n======================================================`);
  console.log(`[Render Workflow: aqi-simulator] Run started at ${timestamp}`);
  console.log(`======================================================`);

  try {
    // 1. Fetch non-warehouse neighborhoods
    const result = await session.run(`
      MATCH (n:Neighborhood)
      WHERE NOT 'Warehouse' IN labels(n) AND (n.isWarehouse IS NULL OR n.isWarehouse = false)
      RETURN n.name AS name, n.aqi AS aqi
    `);

    const neighborhoods = result.records.map((rec) => ({
      name: rec.get('name') as string,
      aqi: Number(rec.get('aqi'))
    }));

    if (neighborhoods.length === 0) {
      console.warn('[Render Workflow: aqi-simulator] No non-warehouse neighborhoods found in Neo4j.');
      return {
        success: false,
        timestamp,
        isSpikeRun: false,
        updatedCount: 0,
        updatedNeighborhoods: []
      };
    }

    // 2. Pick 1 or 2 neighborhoods at random
    const countToPick = Math.random() < 0.5 ? 1 : 2;
    const shuffled = [...neighborhoods].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, countToPick);

    // 3. Determine if this run contains a smog spike (approx 1 in 4 runs = 25%)
    const isSpikeRun = Math.random() < 0.25;
    const updatedNeighborhoods: UpdatedNeighborhood[] = [];

    console.log(
      `[Render Workflow: aqi-simulator] Mode: ${
        isSpikeRun ? '⚠️ HIGH-SMOG SPIKE EVENT (1 in 4 run)' : '🍃 NORMAL AQI FLUCTUATION'
      }`
    );

    for (const place of selected) {
      // If spike run, assign severe 350-500; otherwise normal 100-250
      const newAqi = isSpikeRun
        ? Math.floor(Math.random() * (500 - 350 + 1)) + 350
        : Math.floor(Math.random() * (250 - 100 + 1)) + 100;

      // Update node in Neo4j
      await session.run(
        `MATCH (n:Neighborhood {name: $name})
         SET n.aqi = $newAqi
         RETURN n.name, n.aqi`,
        { name: place.name, newAqi }
      );

      const isSpike = newAqi >= 350;
      updatedNeighborhoods.push({
        name: place.name,
        previousAqi: place.aqi,
        newAqi,
        isSpike
      });

      console.log(
        `[Render Workflow: aqi-simulator] 📍 ${place.name}: AQI ${place.aqi} ➔ ${newAqi} ${
          isSpike ? '🚨 [SPIKE EVENT]' : '✅ [MODERATE]'
        }`
      );
    }

    console.log(
      `[Render Workflow: aqi-simulator] Completed successfully. Updated ${updatedNeighborhoods.length} neighborhood(s).\n`
    );

    return {
      success: true,
      timestamp,
      isSpikeRun,
      updatedCount: updatedNeighborhoods.length,
      updatedNeighborhoods
    };
  } catch (err: any) {
    console.error('[Render Workflow: aqi-simulator] Execution failed:', err.message || err);
    throw err;
  } finally {
    await session.close();
    await driver.close();
  }
}

/**
 * Official Render Workflow Task Definition using @renderinc/sdk
 */
export const aqiSimulatorTask = task(
  {
    name: 'aqi-simulator',
    plan: 'starter',
    timeoutSeconds: 120,
    retry: {
      maxRetries: 3,
      waitDurationMs: 2000,
      backoffScaling: 1.5
    }
  },
  async function aqiSimulator(ctx: TaskContext): Promise<SimulationResult> {
    console.log('[Render Workflow Task: aqi-simulator] Invoked via Render Workflow engine');
    return await executeAqiSimulation();
  }
);

// Fallback: If executed directly via CLI, run simulation immediately
if (process.argv[1] && process.argv[1].includes('aqi-simulator')) {
  executeAqiSimulation()
    .then((result) => {
      console.log('[CLI Output Result]:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[CLI Error]:', err);
      process.exit(1);
    });
}

export default aqiSimulatorTask;
