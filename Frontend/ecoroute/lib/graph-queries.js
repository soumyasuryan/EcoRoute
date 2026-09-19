import { getSession } from './neo4j.js';

// Helper to safely convert Neo4j values to native numbers
function toNativeNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'object' && typeof val.toNumber === 'function') {
    return val.toNumber();
  }
  return Number(val);
}

/**
 * 1. getAllNeighborhoods()
 * Returns all neighborhood nodes with properties: { name, lat, lon, aqi, isWarehouse }
 */
export async function getAllNeighborhoods() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (n:Neighborhood)
      RETURN n.name AS name,
             n.lat AS lat,
             n.lon AS lon,
             n.aqi AS aqi,
             n.zone AS zone,
             ('Warehouse' IN labels(n) OR n.isWarehouse = true) AS isWarehouse
      ORDER BY n.name ASC
    `);

    return result.records.map((record) => ({
      name: record.get('name'),
      lat: toNativeNumber(record.get('lat')),
      lon: toNativeNumber(record.get('lon')),
      aqi: Math.round(toNativeNumber(record.get('aqi'))),
      zone: record.get('zone') || 'Delhi NCR',
      isWarehouse: Boolean(record.get('isWarehouse'))
    }));
  } finally {
    await session.close();
  }
}

/**
 * 2. getAllRoads()
 * Returns all road edges: { source, target, distance }
 */
export async function getAllRoads() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (a:Neighborhood)-[r:ROAD]->(b:Neighborhood)
      RETURN a.name AS source,
             b.name AS target,
             r.distance AS distance
    `);

    return result.records.map((record) => ({
      source: record.get('source'),
      target: record.get('target'),
      distance: toNativeNumber(record.get('distance'))
    }));
  } finally {
    await session.close();
  }
}

/**
 * 3. computeShortestPath({ source, target, mode, alpha })
 * mode: "fastest" | "eco-safe" | "risk-weighted"
 * alpha: weighting multiplier for AQI penalty in risk-weighted mode
 */
export async function computeShortestPath({ source, target, mode = 'fastest', alpha = 1.0 }) {
  if (!source || !target) {
    throw new Error('Both source and target neighborhoods are required.');
  }

  // Fetch nodes and roads from Neo4j
  const [neighborhoods, roads] = await Promise.all([
    getAllNeighborhoods(),
    getAllRoads()
  ]);

  const nodesMap = new Map();
  neighborhoods.forEach((node) => {
    nodesMap.set(node.name, node);
  });

  if (!nodesMap.has(source)) {
    throw new Error(`Source neighborhood "${source}" not found.`);
  }
  if (!nodesMap.has(target)) {
    throw new Error(`Target neighborhood "${target}" not found.`);
  }

  // Identify nodes to exclude for "eco-safe" mode (aqi > 400, except source and target)
  const excludedSet = new Set();
  let bypassedCount = 0;

  if (mode === 'eco-safe') {
    for (const [name, node] of nodesMap.entries()) {
      if (name !== source && name !== target && node.aqi > 400) {
        excludedSet.add(name);
      }
    }
    bypassedCount = excludedSet.size;
  }

  // Build adjacency graph: name -> Array<{ target, distance, weight }>
  const adj = new Map();
  neighborhoods.forEach((n) => adj.set(n.name, []));

  // Map to quickly look up raw physical distance between connected pairs
  const roadDistLookup = new Map();

  for (const road of roads) {
    const { source: u, target: v, distance } = road;
    roadDistLookup.set(`${u}-->${v}`, distance);

    // If in eco-safe mode and either endpoint (except source/target) is hazardous, exclude
    if (mode === 'eco-safe' && (excludedSet.has(u) || excludedSet.has(v))) {
      continue;
    }

    const uNode = nodesMap.get(u);
    const vNode = nodesMap.get(v);
    if (!uNode || !vNode) continue;

    let edgeWeight = distance;

    if (mode === 'risk-weighted') {
      // Risk-weighted penalty formula:
      // weight = distance + (alpha * ((aqiOf(u) + aqiOf(v)) / 2) / 100)
      const avgAqi = (uNode.aqi + vNode.aqi) / 2;
      const numAlpha = Number(alpha) || 1.0;
      const aqiPenalty = (numAlpha * avgAqi) / 100;
      edgeWeight = distance + aqiPenalty;
    }

    if (!adj.has(u)) adj.set(u, []);
    adj.get(u).push({
      target: v,
      distance: distance,
      weight: edgeWeight
    });
  }

  // Run Dijkstra's Algorithm
  const distances = {};
  const previous = {};
  const visited = new Set();

  neighborhoods.forEach((n) => {
    distances[n.name] = Infinity;
  });
  distances[source] = 0;

  // Simple array-based priority queue for graph size ~18 nodes
  const pq = [{ node: source, dist: 0 }];

  while (pq.length > 0) {
    // Sort ascending by distance and pop smallest
    pq.sort((a, b) => a.dist - b.dist);
    const { node: current, dist: currentDist } = pq.shift();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === target) {
      break;
    }

    const neighbors = adj.get(current) || [];
    for (const edge of neighbors) {
      if (visited.has(edge.target)) continue;

      const alt = currentDist + edge.weight;
      if (alt < distances[edge.target]) {
        distances[edge.target] = alt;
        previous[edge.target] = current;
        pq.push({ node: edge.target, dist: alt });
      }
    }
  }

  // Check if destination was reachable
  if (!visited.has(target) || distances[target] === Infinity) {
    return {
      path: null,
      reason: mode === 'eco-safe'
        ? 'No safe path exists (all alternative routes exceed AQI 400).'
        : 'No path could be found between the selected locations.',
      totalDistance: null,
      totalAqiExposure: null,
      hazardPay: null,
      bypassedCount: mode === 'eco-safe' ? bypassedCount : 0
    };
  }

  // Reconstruct path from target back to source
  const path = [];
  let curr = target;
  while (curr) {
    path.unshift(curr);
    curr = previous[curr];
  }

  // Calculate actual total physical distance along the route
  let totalPhysicalDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const key = `${path[i]}-->${path[i + 1]}`;
    const d = roadDistLookup.get(key) || 0;
    totalPhysicalDist += d;
  }
  totalPhysicalDist = Math.round(totalPhysicalDist * 10) / 10;

  // Calculate AQI metrics if risk-weighted
  let totalAqiExposure = null;
  let hazardPay = null;

  if (mode === 'risk-weighted') {
    // Sum of AQI values of all nodes along the path
    totalAqiExposure = path.reduce((sum, name) => {
      const node = nodesMap.get(name);
      return sum + (node ? node.aqi : 0);
    }, 0);

    // Hazard pay formula: totalAqiExposure * 0.5 (rupees)
    // NOTE: This mock compensation formula is illustrative for the hackathon demo, not an official business figure.
    hazardPay = Math.round(totalAqiExposure * 0.5 * 100) / 100;
  }

  return {
    path,
    totalDistance: totalPhysicalDist,
    totalAqiExposure,
    hazardPay,
    bypassedCount: mode === 'eco-safe' ? bypassedCount : 0
  };
}

/**
 * 4. updateNodeAqi(name, newAqi)
 * Updates the AQI of a given neighborhood
 */
export async function updateNodeAqi(name, newAqi) {
  const session = getSession();
  try {
    const roundedAqi = Math.round(Number(newAqi));
    const result = await session.run(
      `MATCH (n:Neighborhood {name: $name})
       SET n.aqi = $newAqi
       RETURN n.name AS name, n.aqi AS aqi`,
      { name, newAqi: roundedAqi }
    );

    if (result.records.length === 0) {
      throw new Error(`Neighborhood "${name}" not found.`);
    }

    return {
      name: result.records[0].get('name'),
      aqi: toNativeNumber(result.records[0].get('aqi'))
    };
  } finally {
    await session.close();
  }
}

/**
 * 5. getHighRiskNodes(threshold = 400)
 * Returns neighborhoods with AQI exceeding the threshold
 */
export async function getHighRiskNodes(threshold = 400) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (n:Neighborhood)
       WHERE n.aqi > $threshold
       RETURN n.name AS name,
              n.aqi AS aqi,
              n.lat AS lat,
              n.lon AS lon,
              ('Warehouse' IN labels(n) OR n.isWarehouse = true) AS isWarehouse
       ORDER BY n.aqi DESC`,
      { threshold: Number(threshold) }
    );

    return result.records.map((record) => ({
      name: record.get('name'),
      aqi: toNativeNumber(record.get('aqi')),
      lat: toNativeNumber(record.get('lat')),
      lon: toNativeNumber(record.get('lon')),
      isWarehouse: Boolean(record.get('isWarehouse'))
    }));
  } finally {
    await session.close();
  }
}
