import { NextResponse } from 'next/server';
import {
  computeShortestPath,
  computeSlaAwareRoute,
  getAllRiders,
  assignRouteToRider
} from '@/lib/graph-queries';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      source,
      target,
      mode = 'fastest',
      alpha = 1.0,
      riderId,
      maxDeliveryMinutes,
      commit = false
    } = body;

    if (!source || !target) {
      return NextResponse.json(
        { error: 'Source and target neighborhoods must be provided.' },
        { status: 400 }
      );
    }

    const hasSlaConstraint =
      mode === 'risk-weighted' &&
      maxDeliveryMinutes !== undefined &&
      maxDeliveryMinutes !== null &&
      maxDeliveryMinutes !== '' &&
      !isNaN(Number(maxDeliveryMinutes)) &&
      Number(maxDeliveryMinutes) > 0;

    let result;
    if (hasSlaConstraint) {
      result = await computeSlaAwareRoute({
        source,
        target,
        maxDeliveryMinutes: Number(maxDeliveryMinutes),
        initialAlpha: parseFloat(alpha) || 1.0
      });
    } else {
      result = await computeShortestPath({
        source,
        target,
        mode,
        alpha: parseFloat(alpha) || 1.0
      });
    }

    // Check Rider budget impact if a rider is selected
    if (riderId) {
      const allRiders = await getAllRiders();
      const matchedRider = allRiders.find(
        (r) => r.name === riderId || r.name.toLowerCase() === String(riderId).toLowerCase()
      );

      if (matchedRider) {
        const routeExposure = result.totalAqiExposure || 0;
        const wouldExceedCap = (matchedRider.currentExposure + routeExposure) > matchedRider.dailyCap;
        const budgetUsagePercent = matchedRider.dailyCap > 0
          ? Math.round((routeExposure / matchedRider.dailyCap) * 100)
          : 0;

        result.riderImpact = {
          riderName: matchedRider.name,
          dailyCap: matchedRider.dailyCap,
          currentExposure: matchedRider.currentExposure,
          routeExposure,
          wouldExceedCap,
          budgetUsagePercent,
          newExposure: matchedRider.currentExposure + routeExposure,
          committed: false
        };

        // Only commit when requested AND a valid path exists
        if (Boolean(commit) && result.path && result.path.length > 0) {
          const updatedRider = await assignRouteToRider(matchedRider.name, routeExposure);
          result.riderImpact.committed = true;
          result.riderImpact.currentExposure = updatedRider.currentExposure;
        }
      }
    }

    result.alpha = parseFloat(alpha) || 1.0;
    result.mode = mode;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in POST /api/route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compute route.' },
      { status: 500 }
    );
  }
}
