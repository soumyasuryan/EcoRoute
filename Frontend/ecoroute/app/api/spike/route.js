import { NextResponse } from 'next/server';
import { getAllNeighborhoods, updateNodeAqi } from '@/lib/graph-queries';

export async function POST() {
  try {
    const neighborhoods = await getAllNeighborhoods();
    const nonWarehouses = neighborhoods.filter((n) => !n.isWarehouse);

    if (nonWarehouses.length < 2) {
      return NextResponse.json(
        { error: 'Not enough non-warehouse neighborhoods to spike.' },
        { status: 400 }
      );
    }

    // Pick 2 random neighborhoods
    const shuffled = [...nonWarehouses].sort(() => 0.5 - Math.random());
    const selected = [shuffled[0], shuffled[1]];

    const updatedNodes = [];

    for (const node of selected) {
      // 65% chance of severe spike (380-520 AQI), 35% chance of reset/normal (100-240 AQI)
      const isSpike = Math.random() < 0.65;
      const newAqi = isSpike
        ? Math.floor(Math.random() * (520 - 380 + 1)) + 380
        : Math.floor(Math.random() * (240 - 100 + 1)) + 100;

      await updateNodeAqi(node.name, newAqi);
      updatedNodes.push({
        name: node.name,
        oldAqi: node.aqi,
        newAqi,
        isSpike: newAqi > 400
      });
    }

    return NextResponse.json({
      message: 'AQI updated successfully.',
      updatedNodes
    });
  } catch (error) {
    console.error('Error in POST /api/spike:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger AQI spike.' },
      { status: 500 }
    );
  }
}
