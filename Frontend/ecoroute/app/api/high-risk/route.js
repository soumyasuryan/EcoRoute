import { NextResponse } from 'next/server';
import { getHighRiskNodes } from '@/lib/graph-queries';

export async function GET() {
  try {
    const highRiskNodes = await getHighRiskNodes(400);
    return NextResponse.json({ highRiskNodes });
  } catch (error) {
    console.error('Error in GET /api/high-risk:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch high-risk nodes.' },
      { status: 500 }
    );
  }
}
