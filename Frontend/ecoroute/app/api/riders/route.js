import { NextResponse } from 'next/server';
import { getAllRiders, resetRiderExposure, resetAllRiders } from '@/lib/graph-queries';

export async function GET() {
  try {
    const riders = await getAllRiders();
    return NextResponse.json({ riders });
  } catch (error) {
    console.error('Error in GET /api/riders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch riders.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, riderName } = body;

    if (action === 'resetAll') {
      const riders = await resetAllRiders();
      return NextResponse.json({ message: 'All rider shifts reset successfully.', riders });
    }

    if (action === 'reset') {
      if (!riderName) {
        return NextResponse.json(
          { error: 'riderName is required to reset a rider.' },
          { status: 400 }
        );
      }
      const rider = await resetRiderExposure(riderName);
      return NextResponse.json({ message: `Shift reset for ${riderName}.`, rider });
    }

    return NextResponse.json(
      { error: `Unknown action: "${action}". Valid actions are "reset" and "resetAll".` },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/riders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update rider.' },
      { status: 500 }
    );
  }
}
