import { NextResponse } from 'next/server';
import { computeShortestPath } from '@/lib/graph-queries';

export async function POST(request) {
  try {
    const body = await request.json();
    const { source, target, mode = 'fastest', alpha = 1.0 } = body;

    if (!source || !target) {
      return NextResponse.json(
        { error: 'Source and target neighborhoods must be provided.' },
        { status: 400 }
      );
    }

    const result = await computeShortestPath({
      source,
      target,
      mode,
      alpha: parseFloat(alpha) || 1.0
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute route.' },
      { status: 500 }
    );
  }
}
