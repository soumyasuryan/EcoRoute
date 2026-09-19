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

// 18 real Delhi NCR neighborhoods
const NEIGHBORHOODS = [
  { name: 'Dwarka', lat: 28.5921, lon: 77.046, isWarehouse: false },
  { name: 'Connaught Place', lat: 28.6315, lon: 77.2167, isWarehouse: false },
  { name: 'Gurgaon Cyber City', lat: 28.495, lon: 77.0895, isWarehouse: true },
  { name: 'Noida Sector 62', lat: 28.628, lon: 77.3649, isWarehouse: false },
  { name: 'Rohini', lat: 28.7495, lon: 77.0736, isWarehouse: false },
  { name: 'Saket', lat: 28.5245, lon: 77.2066, isWarehouse: false },
  { name: 'Karol Bagh', lat: 28.6517, lon: 77.1906, isWarehouse: false },
  { name: 'Vasant Kunj', lat: 28.5293, lon: 77.1524, isWarehouse: false },
  { name: 'Lajpat Nagar', lat: 28.57, lon: 77.24, isWarehouse: false },
  { name: 'Indirapuram', lat: 28.6434, lon: 77.3688, isWarehouse: false },
  { name: 'Greater Kailash', lat: 28.538, lon: 77.2415, isWarehouse: false },
  { name: 'Janakpuri', lat: 28.6219, lon: 77.0878, isWarehouse: false },
  { name: 'Mayur Vihar', lat: 28.6078, lon: 77.2995, isWarehouse: false },
  { name: 'Faridabad', lat: 28.4089, lon: 77.3178, isWarehouse: false },
  { name: 'Chandni Chowk', lat: 28.6562, lon: 77.2304, isWarehouse: false },
  { name: 'Hauz Khas', lat: 28.5494, lon: 77.2001, isWarehouse: false },
  { name: 'Dilshad Garden', lat: 28.6811, lon: 77.3204, isWarehouse: false },
  { name: 'Okhla', lat: 28.5308, lon: 77.2711, isWarehouse: true }
];

// Realistic sparse mesh of physical road connections (bidirectional)
const ROAD_PAIRS = [
  // West & North-West
  ['Dwarka', 'Janakpuri'],
  ['Dwarka', 'Vasant Kunj'],
  ['Dwarka', 'Gurgaon Cyber City'],
  ['Dwarka', 'Rohini'],
  ['Janakpuri', 'Karol Bagh'],
  ['Janakpuri', 'Connaught Place'],
  ['Janakpuri', 'Rohini'],
  ['Rohini', 'Karol Bagh'],
  ['Rohini', 'Chandni Chowk'],

  // Central Delhi
  ['Karol Bagh', 'Connaught Place'],
  ['Karol Bagh', 'Chandni Chowk'],
  ['Chandni Chowk', 'Connaught Place'],
  ['Chandni Chowk', 'Dilshad Garden'],
  ['Chandni Chowk', 'Mayur Vihar'],
  ['Connaught Place', 'Lajpat Nagar'],
  ['Connaught Place', 'Hauz Khas'],

  // East & NCR North-East (Ghaziabad / Noida)
  ['Dilshad Garden', 'Indirapuram'],
  ['Dilshad Garden', 'Noida Sector 62'],
  ['Indirapuram', 'Noida Sector 62'],
  ['Indirapuram', 'Mayur Vihar'],
  ['Noida Sector 62', 'Mayur Vihar'],
  ['Noida Sector 62', 'Okhla'],
  ['Mayur Vihar', 'Lajpat Nagar'],
  ['Mayur Vihar', 'Okhla'],

  // South Delhi & South NCR (Gurgaon / Faridabad)
  ['Lajpat Nagar', 'Hauz Khas'],
  ['Lajpat Nagar', 'Greater Kailash'],
  ['Lajpat Nagar', 'Okhla'],
  ['Hauz Khas', 'Saket'],
  ['Hauz Khas', 'Vasant Kunj'],
  ['Hauz Khas', 'Greater Kailash'],
  ['Saket', 'Greater Kailash'],
  ['Saket', 'Vasant Kunj'],
  ['Saket', 'Okhla'],
  ['Vasant Kunj', 'Gurgaon Cyber City'],
  ['Greater Kailash', 'Okhla'],
  ['Greater Kailash', 'Faridabad'],
  ['Okhla', 'Faridabad'],
  ['Gurgaon Cyber City', 'Saket'],
  ['Gurgaon Cyber City', 'Faridabad']
];

export async function seedDatabase() {
  const session = getSession();
  console.log('🔄 Seeding Neo4j database for EcoRoute...');

  try {
    // 1. Clear existing nodes and relationships
    console.log('🧹 Clearing existing graph data...');
    await session.run('MATCH (n) DETACH DELETE n');

    // 2. Insert Neighborhood nodes (and :Warehouse label for warehouses)
    const coordMap = new Map();
    let nodeCount = 0;

    for (const place of NEIGHBORHOODS) {
      coordMap.set(place.name, { lat: place.lat, lon: place.lon });
      // Randomized initial AQI between 100 and 250
      const aqi = Math.floor(Math.random() * (250 - 100 + 1)) + 100;

      const labels = place.isWarehouse
        ? 'Neighborhood:Warehouse'
        : 'Neighborhood';

      await session.run(
        `CREATE (n:${labels} {
          name: $name,
          lat: $lat,
          lon: $lon,
          aqi: $aqi,
          isWarehouse: $isWarehouse
        })`,
        {
          name: place.name,
          lat: place.lat,
          lon: place.lon,
          aqi: aqi,
          isWarehouse: place.isWarehouse
        }
      );
      nodeCount++;
    }

    console.log(`✅ Created ${nodeCount} neighborhood nodes (${NEIGHBORHOODS.filter(n => n.isWarehouse).map(w => w.name).join(', ')} as warehouses).`);

    // 3. Insert bidirectional :ROAD relationships with calculated Haversine distance
    let edgeCount = 0;
    for (const [sourceName, targetName] of ROAD_PAIRS) {
      const c1 = coordMap.get(sourceName);
      const c2 = coordMap.get(targetName);

      if (!c1 || !c2) continue;

      const dist = haversineDistance(c1.lat, c1.lon, c2.lat, c2.lon);

      // Create bidirectional road
      await session.run(
        `MATCH (a:Neighborhood {name: $src}), (b:Neighborhood {name: $tgt})
         CREATE (a)-[:ROAD {distance: $dist}]->(b),
                (b)-[:ROAD {distance: $dist}]->(a)`,
        {
          src: sourceName,
          tgt: targetName,
          dist: dist
        }
      );
      edgeCount += 2;
    }

    console.log(`✅ Created ${edgeCount / 2} road corridors (${edgeCount} directional :ROAD edges) with computed Haversine distances.`);
    console.log('🎉 Database seeding complete!');

    return { nodeCount, edgeCount: edgeCount / 2 };
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Auto-run when executed directly via node
(async () => {
  try {
    await seedDatabase();
    if (driver) {
      await driver.close();
      console.log('🔒 Driver connection closed.');
    }
  } catch (err) {
    console.error('Fatal seed error:', err);
    process.exit(1);
  }
})();
