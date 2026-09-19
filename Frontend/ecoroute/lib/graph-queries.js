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
             coalesce(n.aqiHistory, []) AS aqiHistory,
             n.zone AS zone,
             ('Warehouse' IN labels(n) OR n.isWarehouse = true) AS isWarehouse
      ORDER BY n.name ASC
    `);

    return result.records.map((record) => {
      const rawHistory = record.get('aqiHistory');
      const aqiHistory = Array.isArray(rawHistory)
        ? rawHistory.map((v) => toNativeNumber(v))
        : [];

      return {
        name: record.get('name'),
        lat: toNativeNumber(record.get('lat')),
        lon: toNativeNumber(record.get('lon')),
        aqi: Math.round(toNativeNumber(record.get('aqi'))),
        aqiHistory,
        zone: record.get('zone') || 'Delhi NCR',
        isWarehouse: Boolean(record.get('isWarehouse'))
      };
    });
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

    const avgAqi = (uNode.aqi + vNode.aqi) / 2;
    let edgeWeight = distance;

    if (mode === 'eco-safe') {
      // Eco-Safe: hard-excludes >400 nodes and strongly optimizes for cleaner, green air corridors
      const pollutionMultiplier = 1 + Math.pow(avgAqi / 140, 2.2);
      edgeWeight = distance * pollutionMultiplier;
    } else if (mode === 'risk-weighted') {
      // Risk-Weighted: alpha-calibrated trade-off between driving distance and air quality
      // alpha = 0.0 -> pure physical distance (fastest)
      // alpha = 1.0 -> balanced commercial trade-off
      // alpha = 2.0 -> heavy priority on clean air & green routes
      const numAlpha = typeof alpha === 'number' ? alpha : parseFloat(alpha) || 1.0;
      const pollutionMultiplier = 1 + (numAlpha * Math.pow(avgAqi / 150, 1.8));
      edgeWeight = distance * pollutionMultiplier;
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

  // Calculate actual total physical distance and distance-weighted pollution along the route
  let totalPhysicalDist = 0;
  let weightedAqiSum = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const key = `${path[i]}-->${path[i + 1]}`;
    const d = roadDistLookup.get(key) || 0;
    totalPhysicalDist += d;

    const uNode = nodesMap.get(path[i]);
    const vNode = nodesMap.get(path[i + 1]);
    const edgeAvgAqi = ((uNode?.aqi || 0) + (vNode?.aqi || 0)) / 2;
    weightedAqiSum += d * edgeAvgAqi;
  }
  totalPhysicalDist = Math.round(totalPhysicalDist * 10) / 10;

  // Distance-weighted average AQI courier actually experiences along the route
  const distWeightedAvgAqi = totalPhysicalDist > 0
    ? weightedAqiSum / totalPhysicalDist
    : (nodesMap.get(path[0])?.aqi || 0);

  // Standardized trip exposure index (normalized to standard 5-leg trip baseline)
  // Reflects true inhaled pollution without artificially penalizing routes that take cleaner detours with more waypoints
  const totalAqiExposure = Math.round(distWeightedAvgAqi * 5);

  // Practical delivery partner hazard compensation formula:
  // Base distance incentive (₹1.50/km) + smog surge bonus (₹0.10 per AQI point above 150 baseline)
  const distanceComponent = totalPhysicalDist * 1.5;
  const smogSurcharge = Math.max(0, distWeightedAvgAqi - 150) * 0.1;
  const hazardPay = Math.round((distanceComponent + smogSurcharge) * 100) / 100;

  return {
    path,
    totalDistance: totalPhysicalDist,
    totalAqiExposure,
    avgAqi: Math.round(distWeightedAvgAqi),
    hazardPay,
    bypassedCount: mode === 'eco-safe' ? bypassedCount : 0
  };
}

/**
 * 4. updateNodeAqi(name, newAqi)
 * Updates the AQI of a given neighborhood, keeping up to 8 historical entries
 */
export async function updateNodeAqi(name, newAqi) {
  const session = getSession();
  try {
    const roundedAqi = Math.round(Number(newAqi));

    // Read current AQI and historical trend
    const currentRes = await session.run(
      `MATCH (n:Neighborhood {name: $name})
       RETURN n.aqi AS aqi, coalesce(n.aqiHistory, []) AS aqiHistory`,
      { name }
    );

    if (currentRes.records.length === 0) {
      throw new Error(`Neighborhood "${name}" not found.`);
    }

    const currentAqiBeforeOverwrite = toNativeNumber(currentRes.records[0].get('aqi'));
    const rawHistory = currentRes.records[0].get('aqiHistory');
    const existingHistory = Array.isArray(rawHistory)
      ? rawHistory.map((v) => toNativeNumber(v))
      : [];

    const newHistory = [...existingHistory, currentAqiBeforeOverwrite].slice(-8);

    const result = await session.run(
      `MATCH (n:Neighborhood {name: $name})
       SET n.aqi = $newAqi, n.aqiHistory = $newHistory
       RETURN n.name AS name, n.aqi AS aqi, n.aqiHistory AS aqiHistory`,
      { name, newAqi: roundedAqi, newHistory }
    );

    return {
      name: result.records[0].get('name'),
      aqi: toNativeNumber(result.records[0].get('aqi')),
      aqiHistory: newHistory
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
              coalesce(n.aqiHistory, []) AS aqiHistory,
              n.lat AS lat,
              n.lon AS lon,
              ('Warehouse' IN labels(n) OR n.isWarehouse = true) AS isWarehouse
       ORDER BY n.aqi DESC`,
      { threshold: Number(threshold) }
    );

    return result.records.map((record) => {
      const rawHistory = record.get('aqiHistory');
      const aqiHistory = Array.isArray(rawHistory)
        ? rawHistory.map((v) => toNativeNumber(v))
        : [];
      return {
        name: record.get('name'),
        aqi: toNativeNumber(record.get('aqi')),
        aqiHistory,
        lat: toNativeNumber(record.get('lat')),
        lon: toNativeNumber(record.get('lon')),
        isWarehouse: Boolean(record.get('isWarehouse'))
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * 6. getAllRiders()
 * Returns all Rider nodes: { name, dailyCap, currentExposure }
 */
export async function getAllRiders() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (r:Rider)
      RETURN r.name AS name,
             r.dailyCap AS dailyCap,
             coalesce(r.currentExposure, 0) AS currentExposure
      ORDER BY r.name ASC
    `);

    return result.records.map((record) => ({
      name: record.get('name'),
      dailyCap: toNativeNumber(record.get('dailyCap')),
      currentExposure: toNativeNumber(record.get('currentExposure'))
    }));
  } finally {
    await session.close();
  }
}

/**
 * 7. resetRiderExposure(name) & resetAllRiders()
 */
export async function resetRiderExposure(name) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (r:Rider {name: $name})
       SET r.currentExposure = 0
       RETURN r.name AS name, r.dailyCap AS dailyCap, r.currentExposure AS currentExposure`,
      { name }
    );
    if (result.records.length === 0) {
      throw new Error(`Rider "${name}" not found.`);
    }
    return {
      name: result.records[0].get('name'),
      dailyCap: toNativeNumber(result.records[0].get('dailyCap')),
      currentExposure: 0
    };
  } finally {
    await session.close();
  }
}

export async function resetAllRiders() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (r:Rider)
      SET r.currentExposure = 0
      RETURN r.name AS name, r.dailyCap AS dailyCap, r.currentExposure AS currentExposure
      ORDER BY r.name ASC
    `);
    return result.records.map((record) => ({
      name: record.get('name'),
      dailyCap: toNativeNumber(record.get('dailyCap')),
      currentExposure: 0
    }));
  } finally {
    await session.close();
  }
}

/**
 * 8. assignRouteToRider(riderName, exposureAmount)
 * Increments a rider's currentExposure by exposureAmount.
 * ONLY called when route is actually committed.
 */
export async function assignRouteToRider(riderName, exposureAmount) {
  const session = getSession();
  try {
    const amount = Math.round(Number(exposureAmount)) || 0;
    const result = await session.run(
      `MATCH (r:Rider {name: $riderName})
       SET r.currentExposure = coalesce(r.currentExposure, 0) + $amount
       RETURN r.name AS name, r.dailyCap AS dailyCap, r.currentExposure AS currentExposure`,
      { riderName, amount }
    );
    if (result.records.length === 0) {
      throw new Error(`Rider "${riderName}" not found.`);
    }
    return {
      name: result.records[0].get('name'),
      dailyCap: toNativeNumber(result.records[0].get('dailyCap')),
      currentExposure: toNativeNumber(result.records[0].get('currentExposure'))
    };
  } finally {
    await session.close();
  }
}

/**
 * 9. computeComparisonRoutes({ source, target, alpha })
 * Calls computeShortestPath three times in parallel (fastest, eco-safe, risk-weighted)
 */
export async function computeComparisonRoutes({ source, target, alpha = 1.0 }) {
  const numAlpha = parseFloat(alpha) || 1.0;
  const [fastest, ecoSafe, riskWeighted] = await Promise.all([
    computeShortestPath({ source, target, mode: 'fastest', alpha: numAlpha }),
    computeShortestPath({ source, target, mode: 'eco-safe', alpha: numAlpha }),
    computeShortestPath({ source, target, mode: 'risk-weighted', alpha: numAlpha })
  ]);
  return {
    fastest,
    ecoSafe,
    riskWeighted
  };
}

/**
 * 10. computeSlaAwareRoute({ source, target, maxDeliveryMinutes, initialAlpha, avgSpeedKmph })
 * Computes risk-weighted path, and steps alpha down until time budget is met or reaches 0.
 */
export async function computeSlaAwareRoute({
  source,
  target,
  maxDeliveryMinutes,
  initialAlpha = 1.0,
  avgSpeedKmph = 25
}) {
  const targetMinutes = Number(maxDeliveryMinutes);
  let curAlpha = Math.round(Number(initialAlpha) * 10) / 10;

  // 1. Compute at initialAlpha
  const initialResult = await computeShortestPath({
    source,
    target,
    mode: 'risk-weighted',
    alpha: curAlpha
  });

  if (!initialResult.path) {
    return {
      ...initialResult,
      effectiveAlpha: null,
      slaRelaxed: false,
      slaAchievable: false,
      estimatedMinutes: null
    };
  }

  const initialEstimatedMinutes = Math.round(((initialResult.totalDistance || 0) / avgSpeedKmph) * 60 * 10) / 10;

  if (initialEstimatedMinutes <= targetMinutes) {
    return {
      ...initialResult,
      effectiveAlpha: curAlpha,
      slaRelaxed: false,
      slaAchievable: true,
      estimatedMinutes: initialEstimatedMinutes
    };
  }

  // 2. Step alpha down by 0.1 at a time for finer SLA precision
  while (curAlpha > 0.01) {
    curAlpha = Math.round((curAlpha - 0.1) * 100) / 100;
    if (curAlpha < 0) curAlpha = 0;

    const res = await computeShortestPath({
      source,
      target,
      mode: 'risk-weighted',
      alpha: curAlpha
    });

    if (res.path) {
      const estMins = Math.round(((res.totalDistance || 0) / avgSpeedKmph) * 60 * 10) / 10;
      if (estMins <= targetMinutes) {
        return {
          ...res,
          effectiveAlpha: curAlpha,
          slaRelaxed: true,
          slaAchievable: true,
          estimatedMinutes: estMins,
          targetMinutes
        };
      }
    }

    if (curAlpha === 0) break;
  }

  // 3. Fall back to plain "fastest" route
  const fastestResult = await computeShortestPath({
    source,
    target,
    mode: 'fastest'
  });

  const fastestEstimatedMinutes = fastestResult.totalDistance != null
    ? Math.round((fastestResult.totalDistance / avgSpeedKmph) * 60 * 10) / 10
    : null;

  const isAchievable = fastestEstimatedMinutes != null && fastestEstimatedMinutes <= targetMinutes;

  return {
    ...fastestResult,
    effectiveAlpha: isAchievable ? 0.0 : null,
    slaRelaxed: true,
    slaAchievable: isAchievable,
    estimatedMinutes: fastestEstimatedMinutes,
    targetMinutes
  };
}
