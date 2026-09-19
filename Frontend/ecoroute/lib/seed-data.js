import { driver, getSession } from './neo4j.js';

// Haversine formula to compute great-circle distance between two coords in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

// 50 realistic Delhi NCR nodes (5 Strategic Regional Fulfillment Warehouses + 45 Customer Hubs)
export const NEIGHBORHOODS = [
  // 5 Strategic Fulfillment Warehouses
  { name: 'Gurgaon Cyber City Hub', lat: 28.4950, lon: 77.0895, isWarehouse: true, zone: 'South-West NCR' },
  { name: 'Okhla Logistics Park', lat: 28.5308, lon: 77.2711, isWarehouse: true, zone: 'South Delhi' },
  { name: 'Anand Vihar Cargo Terminal', lat: 28.6469, lon: 77.3160, isWarehouse: true, zone: 'East Delhi' },
  { name: 'Dwarka Sector 21 Gateway', lat: 28.5523, lon: 77.0583, isWarehouse: true, zone: 'West Delhi' },
  { name: 'Alipur North Hub', lat: 28.7983, lon: 77.1332, isWarehouse: true, zone: 'North Delhi' },

  // Central Delhi (7)
  { name: 'Connaught Place', lat: 28.6315, lon: 77.2167, isWarehouse: false, zone: 'Central Delhi' },
  { name: 'Chandni Chowk', lat: 28.6562, lon: 77.2304, isWarehouse: false, zone: 'Central Delhi' },
  { name: 'Karol Bagh', lat: 28.6517, lon: 77.1906, isWarehouse: false, zone: 'Central Delhi' },
  { name: 'Paharganj', lat: 28.6434, lon: 77.2150, isWarehouse: false, zone: 'Central Delhi' },
  { name: 'Civil Lines', lat: 28.6814, lon: 77.2227, isWarehouse: false, zone: 'Central Delhi' },
  { name: 'Chanakyapuri', lat: 28.5983, lon: 77.1973, isWarehouse: false, zone: 'Central Delhi' },
  { name: 'Patel Nagar', lat: 28.6575, lon: 77.1601, isWarehouse: false, zone: 'Central Delhi' },

  // South Delhi (12)
  { name: 'Hauz Khas', lat: 28.5494, lon: 77.2001, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Saket', lat: 28.5245, lon: 77.2066, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Greater Kailash', lat: 28.5380, lon: 77.2415, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Lajpat Nagar', lat: 28.5700, lon: 77.2400, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Vasant Kunj', lat: 28.5293, lon: 77.1524, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Nehru Place', lat: 28.5494, lon: 77.2530, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Malviya Nagar', lat: 28.5323, lon: 77.2086, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Defence Colony', lat: 28.5733, lon: 77.2312, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Mehrauli', lat: 28.5177, lon: 77.1852, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Sarita Vihar', lat: 28.5284, lon: 77.2982, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Green Park', lat: 28.5588, lon: 77.2074, isWarehouse: false, zone: 'South Delhi' },
  { name: 'Chittaranjan Park', lat: 28.5398, lon: 77.2505, isWarehouse: false, zone: 'South Delhi' },

  // West Delhi (9)
  { name: 'Dwarka', lat: 28.5921, lon: 77.0460, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Janakpuri', lat: 28.6219, lon: 77.0878, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Rajouri Garden', lat: 28.6415, lon: 77.1209, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Punjabi Bagh', lat: 28.6692, lon: 77.1294, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Paschim Vihar', lat: 28.6695, lon: 77.0945, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Vikaspuri', lat: 28.6366, lon: 77.0711, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Tilak Nagar', lat: 28.6366, lon: 77.0961, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Uttam Nagar', lat: 28.6219, lon: 77.0601, isWarehouse: false, zone: 'West Delhi' },
  { name: 'Moti Nagar', lat: 28.6570, lon: 77.1420, isWarehouse: false, zone: 'West Delhi' },

  // North Delhi (6)
  { name: 'Rohini', lat: 28.7495, lon: 77.0736, isWarehouse: false, zone: 'North Delhi' },
  { name: 'Pitampura', lat: 28.6990, lon: 77.1384, isWarehouse: false, zone: 'North Delhi' },
  { name: 'Model Town', lat: 28.7027, lon: 77.1937, isWarehouse: false, zone: 'North Delhi' },
  { name: 'Shalimar Bagh', lat: 28.7166, lon: 77.1593, isWarehouse: false, zone: 'North Delhi' },
  { name: 'Ashok Vihar', lat: 28.6917, lon: 77.1724, isWarehouse: false, zone: 'North Delhi' },
  { name: 'Burari', lat: 28.7540, lon: 77.1990, isWarehouse: false, zone: 'North Delhi' },

  // East Delhi (6)
  { name: 'Mayur Vihar', lat: 28.6078, lon: 77.2995, isWarehouse: false, zone: 'East Delhi' },
  { name: 'Laxmi Nagar', lat: 28.6312, lon: 77.2776, isWarehouse: false, zone: 'East Delhi' },
  { name: 'Preet Vihar', lat: 28.6411, lon: 77.2965, isWarehouse: false, zone: 'East Delhi' },
  { name: 'Dilshad Garden', lat: 28.6811, lon: 77.3204, isWarehouse: false, zone: 'East Delhi' },
  { name: 'Shahdara', lat: 28.6738, lon: 77.2905, isWarehouse: false, zone: 'East Delhi' },
  { name: 'Patparganj', lat: 28.6263, lon: 77.3012, isWarehouse: false, zone: 'East Delhi' },

  // NCR Satellites: Noida, Ghaziabad, Faridabad (7)
  { name: 'Noida Sector 18', lat: 28.5708, lon: 77.3260, isWarehouse: false, zone: 'Noida NCR' },
  { name: 'Noida Sector 62', lat: 28.6280, lon: 77.3649, isWarehouse: false, zone: 'Noida NCR' },
  { name: 'Indirapuram', lat: 28.6434, lon: 77.3688, isWarehouse: false, zone: 'Ghaziabad NCR' },
  { name: 'Vaishali', lat: 28.6467, lon: 77.3400, isWarehouse: false, zone: 'Ghaziabad NCR' },
  { name: 'Kaushambi', lat: 28.6462, lon: 77.3255, isWarehouse: false, zone: 'Ghaziabad NCR' },
  { name: 'Faridabad NIT', lat: 28.3962, lon: 77.3025, isWarehouse: false, zone: 'Faridabad NCR' },
  { name: 'Old Faridabad', lat: 28.4237, lon: 77.3197, isWarehouse: false, zone: 'Faridabad NCR' }
];

// Dense, realistic arterial network mesh connecting Delhi NCR
export const ROAD_PAIRS = [
  // Gurgaon Hub & Gateway Connections
  ['Gurgaon Cyber City Hub', 'Vasant Kunj'],
  ['Gurgaon Cyber City Hub', 'Dwarka Sector 21 Gateway'],
  ['Gurgaon Cyber City Hub', 'Mehrauli'],
  ['Gurgaon Cyber City Hub', 'Saket'],
  ['Dwarka Sector 21 Gateway', 'Dwarka'],
  ['Dwarka Sector 21 Gateway', 'Uttam Nagar'],
  ['Dwarka Sector 21 Gateway', 'Vasant Kunj'],

  // West Delhi Corridor
  ['Dwarka', 'Janakpuri'],
  ['Dwarka', 'Uttam Nagar'],
  ['Dwarka', 'Vasant Kunj'],
  ['Uttam Nagar', 'Tilak Nagar'],
  ['Tilak Nagar', 'Janakpuri'],
  ['Janakpuri', 'Vikaspuri'],
  ['Janakpuri', 'Rajouri Garden'],
  ['Vikaspuri', 'Paschim Vihar'],
  ['Paschim Vihar', 'Punjabi Bagh'],
  ['Rajouri Garden', 'Punjabi Bagh'],
  ['Rajouri Garden', 'Moti Nagar'],
  ['Moti Nagar', 'Patel Nagar'],
  ['Moti Nagar', 'Karol Bagh'],
  ['Patel Nagar', 'Karol Bagh'],
  ['Punjabi Bagh', 'Pitampura'],
  ['Punjabi Bagh', 'Ashok Vihar'],

  // North Delhi Corridor
  ['Alipur North Hub', 'Burari'],
  ['Alipur North Hub', 'Rohini'],
  ['Alipur North Hub', 'Shalimar Bagh'],
  ['Rohini', 'Pitampura'],
  ['Rohini', 'Shalimar Bagh'],
  ['Pitampura', 'Shalimar Bagh'],
  ['Pitampura', 'Ashok Vihar'],
  ['Shalimar Bagh', 'Model Town'],
  ['Ashok Vihar', 'Model Town'],
  ['Model Town', 'Civil Lines'],
  ['Model Town', 'Burari'],
  ['Burari', 'Civil Lines'],

  // Central Delhi Ring
  ['Civil Lines', 'Chandni Chowk'],
  ['Chandni Chowk', 'Paharganj'],
  ['Chandni Chowk', 'Connaught Place'],
  ['Karol Bagh', 'Paharganj'],
  ['Karol Bagh', 'Connaught Place'],
  ['Paharganj', 'Connaught Place'],
  ['Connaught Place', 'Chanakyapuri'],
  ['Connaught Place', 'Lajpat Nagar'],
  ['Chanakyapuri', 'Green Park'],
  ['Chanakyapuri', 'Hauz Khas'],

  // South Delhi Arterials
  ['Vasant Kunj', 'Hauz Khas'],
  ['Vasant Kunj', 'Mehrauli'],
  ['Mehrauli', 'Saket'],
  ['Saket', 'Malviya Nagar'],
  ['Saket', 'Greater Kailash'],
  ['Malviya Nagar', 'Hauz Khas'],
  ['Hauz Khas', 'Green Park'],
  ['Green Park', 'Defence Colony'],
  ['Defence Colony', 'Lajpat Nagar'],
  ['Greater Kailash', 'Nehru Place'],
  ['Greater Kailash', 'Lajpat Nagar'],
  ['Chittaranjan Park', 'Greater Kailash'],
  ['Chittaranjan Park', 'Nehru Place'],
  ['Nehru Place', 'Okhla Logistics Park'],
  ['Nehru Place', 'Sarita Vihar'],
  ['Lajpat Nagar', 'Nehru Place'],
  ['Lajpat Nagar', 'Okhla Logistics Park'],

  // South-East & Faridabad Corridors
  ['Okhla Logistics Park', 'Sarita Vihar'],
  ['Okhla Logistics Park', 'Noida Sector 18'],
  ['Okhla Logistics Park', 'Mayur Vihar'],
  ['Sarita Vihar', 'Old Faridabad'],
  ['Old Faridabad', 'Faridabad NIT'],

  // Trans-Yamuna & East Delhi
  ['Chandni Chowk', 'Shahdara'],
  ['Civil Lines', 'Shahdara'],
  ['Shahdara', 'Dilshad Garden'],
  ['Shahdara', 'Anand Vihar Cargo Terminal'],
  ['Dilshad Garden', 'Anand Vihar Cargo Terminal'],
  ['Anand Vihar Cargo Terminal', 'Preet Vihar'],
  ['Anand Vihar Cargo Terminal', 'Kaushambi'],
  ['Anand Vihar Cargo Terminal', 'Vaishali'],
  ['Connaught Place', 'Laxmi Nagar'],
  ['Laxmi Nagar', 'Preet Vihar'],
  ['Laxmi Nagar', 'Patparganj'],
  ['Preet Vihar', 'Patparganj'],
  ['Patparganj', 'Mayur Vihar'],
  ['Mayur Vihar', 'Noida Sector 18'],
  ['Mayur Vihar', 'Anand Vihar Cargo Terminal'],

  // Ghaziabad & Noida NCR
  ['Kaushambi', 'Vaishali'],
  ['Vaishali', 'Indirapuram'],
  ['Indirapuram', 'Noida Sector 62'],
  ['Noida Sector 62', 'Noida Sector 18'],
  ['Noida Sector 62', 'Patparganj'],
  ['Noida Sector 18', 'Preet Vihar']
];

// Baseline realistic winter AQI tiers per neighborhood:
// - Normal (<200)
// - Elevated (200-400)
// - Severe (>400)
export const NODE_AQI_DEFAULTS = {
  // Severe (>400) - 8 major industrial & heavy-traffic hotspots
  'Anand Vihar Cargo Terminal': 445,
  'Shahdara': 430,
  'Burari': 425,
  'Paharganj': 440,
  'Punjabi Bagh': 420,
  'Sarita Vihar': 410,
  'Indirapuram': 435,
  'Patparganj': 425,

  // Normal (<200) - 12 green, residential, ridge & diplomatic zones
  'Chanakyapuri': 135,
  'Civil Lines': 165,
  'Hauz Khas': 170,
  'Saket': 180,
  'Greater Kailash': 175,
  'Vasant Kunj': 155,
  'Defence Colony': 160,
  'Mehrauli': 145,
  'Green Park': 175,
  'Dwarka Sector 21 Gateway': 160,
  'Dwarka': 175,
  'Rohini': 185,

  // Elevated (200-400) - 30 commercial, sub-arterial & residential hubs
  'Chandni Chowk': 365,
  'Connaught Place': 285,
  'Karol Bagh': 340,
  'Patel Nagar': 310,
  'Moti Nagar': 325,
  'Lajpat Nagar': 270,
  'Nehru Place': 320,
  'Malviya Nagar': 240,
  'Chittaranjan Park': 230,
  'Janakpuri': 260,
  'Rajouri Garden': 315,
  'Paschim Vihar': 290,
  'Vikaspuri': 250,
  'Tilak Nagar': 280,
  'Uttam Nagar': 330,
  'Pitampura': 270,
  'Model Town': 310,
  'Shalimar Bagh': 290,
  'Ashok Vihar': 330,
  'Mayur Vihar': 340,
  'Laxmi Nagar': 360,
  'Preet Vihar': 340,
  'Dilshad Garden': 350,
  'Noida Sector 18': 280,
  'Noida Sector 62': 340,
  'Vaishali': 320,
  'Kaushambi': 310,
  'Faridabad NIT': 330,
  'Old Faridabad': 315,
  'Alipur North Hub': 280,
  'Okhla Logistics Park': 310,
  'Gurgaon Cyber City Hub': 240
};

/**
 * Seed the Neo4j AuraDB with all 50 neighborhoods and arterial road network
 */
export async function seedDatabase() {
  const session = getSession();
  console.log('🔄 Seeding Neo4j database with 50 Delhi NCR nodes and corridors...');

  try {
    // 1. Clear existing graph data
    console.log('🧹 Clearing existing graph data...');
    await session.run(`MATCH (r:Rider) DETACH DELETE r`);
    await session.run(`MATCH (n:Neighborhood) DETACH DELETE n`);

    // 2. Insert Neighborhood nodes with initial realistic winter AQI values
    console.log(`📍 Inserting ${NEIGHBORHOODS.length} neighborhood and warehouse nodes...`);
    const nodeMap = new Map();

    for (const n of NEIGHBORHOODS) {
      const defaultAqi = NODE_AQI_DEFAULTS[n.name];
      const initialAqi = defaultAqi !== undefined
        ? defaultAqi
        : Math.floor(Math.random() * (350 - 230 + 1)) + 230; // Elevated tier: 230-350

      const initialHistory = [
        Math.round(initialAqi * 0.88),
        Math.round(initialAqi * 0.94),
        initialAqi
      ];
      nodeMap.set(n.name, n);

      await session.run(
        `
        CREATE (n:Neighborhood {
          name: $name,
          lat: $lat,
          lon: $lon,
          aqi: $aqi,
          aqiHistory: $aqiHistory,
          isWarehouse: $isWarehouse,
          zone: $zone
        })
        WITH n
        CALL apoc.create.addLabels(n, CASE WHEN $isWarehouse THEN ['Warehouse'] ELSE [] END)
        YIELD node
        RETURN node
        `,
        {
          name: n.name,
          lat: n.lat,
          lon: n.lon,
          aqi: initialAqi,
          aqiHistory: initialHistory,
          isWarehouse: n.isWarehouse,
          zone: n.zone || 'Delhi NCR'
        }
      ).catch(async () => {
        // Fallback without apoc
        const labelQuery = n.isWarehouse
          ? `CREATE (n:Neighborhood:Warehouse { name: $name, lat: $lat, lon: $lon, aqi: $aqi, aqiHistory: $aqiHistory, isWarehouse: true, zone: $zone })`
          : `CREATE (n:Neighborhood { name: $name, lat: $lat, lon: $lon, aqi: $aqi, aqiHistory: $aqiHistory, isWarehouse: false, zone: $zone })`;
        await session.run(labelQuery, {
          name: n.name,
          lat: n.lat,
          lon: n.lon,
          aqi: initialAqi,
          aqiHistory: initialHistory,
          zone: n.zone || 'Delhi NCR'
        });
      });
    }

    // 3. Create bidirectional ROAD corridors
    console.log(`🛣️ Creating arterial road corridors with Haversine distances...`);
    let edgeCount = 0;

    for (const [sourceName, targetName] of ROAD_PAIRS) {
      const source = nodeMap.get(sourceName);
      const target = nodeMap.get(targetName);

      if (!source || !target) {
        console.warn(`Skipping missing road pair: ${sourceName} - ${targetName}`);
        continue;
      }

      const distance = haversineDistance(source.lat, source.lon, target.lat, target.lon);

      // Create bidirectional edges
      await session.run(
        `
        MATCH (a:Neighborhood {name: $sourceName})
        MATCH (b:Neighborhood {name: $targetName})
        MERGE (a)-[r1:ROAD {distance: $distance}]->(b)
        MERGE (b)-[r2:ROAD {distance: $distance}]->(a)
        `,
        {
          sourceName,
          targetName,
          distance
        }
      );
      edgeCount += 2;
    }

    // 4. Create 4 :Rider nodes with properties { name, dailyCap, currentExposure: 0 }
    console.log('🚴 Seeding fleet riders with daily exposure caps...');
    const RIDERS = [
      { name: 'Rider A (Rajesh)', dailyCap: 2000, currentExposure: 0 },
      { name: 'Rider B (Amit)', dailyCap: 2000, currentExposure: 0 },
      { name: 'Rider C (Sunil)', dailyCap: 2000, currentExposure: 0 },
      { name: 'Rider D (Vikas)', dailyCap: 2000, currentExposure: 0 }
    ];

    for (const r of RIDERS) {
      await session.run(
        `CREATE (r:Rider { name: $name, dailyCap: $dailyCap, currentExposure: $currentExposure })`,
        r
      );
    }

    console.log(`✅ Seeded ${NEIGHBORHOODS.length} nodes, ${edgeCount} directional :ROAD edges, and ${RIDERS.length} fleet riders.`);
    console.log('🎉 Database seeding complete!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Auto-run when executed directly via Node
if (process.argv[1]?.endsWith('seed-data.js')) {
  seedDatabase()
    .then(() => driver.close())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
