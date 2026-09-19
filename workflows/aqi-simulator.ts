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
 * Load environment variables from .env.local if not already set in process.env
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
 * Get Neo4j Driver instance
 */
function getNeo4jDriver(): Driver {
  loadEnvFallback();

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER || process.env.NEO4J_USERNAME || '0b15a9dc';
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !password) {
    throw new Error(
      'Missing Neo4j connection credentials. Ensure NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD are set.'
    );
  }

  return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

/**
 * Executes a single simulation step:
 * 1. Fetches all non-warehouse neighborhoods from Neo4j
 * 2. Selects 1–2 neighborhoods at random
 * 3. Updates their AQI:
 *    - ~75% normal winter AQI (100–250)
 *    - ~25% (1 in 4 runs) winter smog spike (350–500)
 * 4. Logs before/after values with timestamps
 */
export async function runAqiSimulation(driver?: Driver): Promise<SimulationResult> {
  const localDriver = driver || getNeo4jDriver();
  const session: Session = localDriver.session();
  const timestamp = new Date().toISOString();

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
      console.warn('⚠️ No non-warehouse neighborhoods found in Neo4j database.');
      return {
        success: false,
        timestamp,
        isSpikeRun: false,
        updatedCount: 0,
        updatedNeighborhoods: []
      };
    }

    // 2. Select 1 or 2 random neighborhoods
    const countToPick = Math.random() < 0.5 ? 1 : 2;
    const shuffled = [...neighborhoods].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, countToPick);

    // 3. Determine if this run creates a smog spike (about 1 in 4 runs = 25%)
    const isSpikeRun = Math.random() < 0.25;
    const updatedNeighborhoods: UpdatedNeighborhood[] = [];

    console.log(`\n------------------------------------------------------`);
    console.log(`[AQI Workflow] Iteration at ${new Date().toLocaleTimeString()} (${timestamp})`);
    console.log(
      `[AQI Workflow] Status: ${
        isSpikeRun ? '🚨 SMOG SPIKE EVENT (1 in 4 run)' : '🍃 NORMAL AQI FLUCTUATION'
      }`
    );

    for (const place of selected) {
      const newAqi = isSpikeRun
        ? Math.floor(Math.random() * (500 - 350 + 1)) + 350
        : Math.floor(Math.random() * (250 - 100 + 1)) + 100;

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
        `  📍 ${place.name.padEnd(20)} AQI ${String(place.aqi).padStart(3)} ➔ ${String(newAqi).padStart(3)} ${
          isSpike ? '⚠️ [SEVERE SPIKE]' : '✅ [MODERATE]'
        }`
      );
    }

    console.log(`[AQI Workflow] Successfully committed to Neo4j AuraDB.`);
    console.log(`------------------------------------------------------`);

    return {
      success: true,
      timestamp,
      isSpikeRun,
      updatedCount: updatedNeighborhoods.length,
      updatedNeighborhoods
    };
  } finally {
    await session.close();
    if (!driver) {
      await localDriver.close();
    }
  }
}

/**
 * Continuous Background Daemon loop
 */
async function startDaemon(): Promise<void> {
  const driver = getNeo4jDriver();

  // Read interval from env or default to 60 seconds (1 minute)
  const intervalSeconds = parseInt(process.env.INTERVAL_SECONDS || '60', 10);
  const intervalMs = intervalSeconds * 1000;

  console.log(`======================================================`);
  console.log(`🌱 EcoRoute Background AQI Simulator Daemon Started`);
  console.log(`⚡ Connected to: ${process.env.NEO4J_URI || 'Neo4j Aura'}`);
  console.log(`⏱️ Interval: Every ${intervalSeconds} seconds`);
  console.log(`Press Ctrl+C at any time to gracefully stop.`);
  console.log(`======================================================`);

  // Handle graceful exit
  let isRunning = true;
  const shutdown = async () => {
    if (!isRunning) return;
    isRunning = false;
    console.log('\n🛑 Stopping AQI simulator daemon gracefully...');
    await driver.close();
    console.log('🔒 Neo4j connection closed. Goodbye!\n');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Initial immediate run
  try {
    await runAqiSimulation(driver);
  } catch (err: any) {
    console.error('Initial simulation error:', err.message || err);
  }

  // Periodic loop
  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (!isRunning) break;
    try {
      await runAqiSimulation(driver);
    } catch (err: any) {
      console.error('Simulation error:', err.message || err);
    }
  }
}

// Entrypoint execution
const isOnce = process.argv.includes('--once');

if (isOnce) {
  runAqiSimulation()
    .then((res) => {
      console.log('Single-run completed:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Single-run failed:', err);
      process.exit(1);
    });
} else {
  startDaemon().catch((err) => {
    console.error('Daemon startup error:', err);
    process.exit(1);
  });
}
