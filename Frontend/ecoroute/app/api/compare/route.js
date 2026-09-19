import { NextResponse } from 'next/server';
import { computeComparisonRoutes } from '@/lib/graph-queries';

export async function POST(request) {
  try {
    const body = await request.json();
    const { source, target, alpha = 1.0 } = body;

    if (!source || !target) {
      return NextResponse.json(
        { error: 'Source and target neighborhoods must be provided.' },
        { status: 400 }
      );
    }

    const results = await computeComparisonRoutes({
      source,
      target,
      alpha: parseFloat(alpha) || 1.0
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in POST /api/compare:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute comparison routes.' },
      { status: 500 }
    );
  }
}
