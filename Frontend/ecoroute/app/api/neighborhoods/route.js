import { NextResponse } from 'next/server';
import { getAllNeighborhoods, getAllRoads } from '@/lib/graph-queries';

export async function GET() {
  try {
    const [neighborhoods, roads] = await Promise.all([
      getAllNeighborhoods(),
      getAllRoads()
    ]);
    return NextResponse.json({ neighborhoods, roads });
  } catch (error) {
    console.error('Error in GET /api/neighborhoods:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch neighborhoods and roads.' },
      { status: 500 }
    );
  }
}
