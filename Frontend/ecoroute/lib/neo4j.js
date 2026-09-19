import neo4j from 'neo4j-driver';

// In Next.js, process.env is automatically populated from .env.local.
// For direct CLI runs (e.g. `node lib/seed-data.js`), we fallback to reading .env.local if not loaded.
if (!process.env.NEO4J_URI && typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valParts] = trimmed.split('=');
          if (key && valParts.length) {
            process.env[key.trim()] = valParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    }
  } catch {
    // Ignore fallback errors
  }
}

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER || process.env.NEO4J_USERNAME || '0b15a9dc';
const password = process.env.NEO4J_PASSWORD;

// Global singleton to prevent connection leaks during Next.js Hot Module Replacement (HMR)
const globalForNeo4j = globalThis;

if (!globalForNeo4j._neo4jDriver && uri && password) {
  globalForNeo4j._neo4jDriver = neo4j.driver(uri, neo4j.auth.basic(user, password));
}

export const driver = globalForNeo4j._neo4jDriver;

export function getSession(database) {
  if (!driver) {
    throw new Error('Neo4j driver is not initialized. Verify NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD.');
  }
  return driver.session(database ? { database } : undefined);
}

export default driver;
