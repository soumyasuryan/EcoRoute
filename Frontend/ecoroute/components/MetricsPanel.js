'use client';

import { useMemo } from 'react';

export default function MetricsPanel({
  currentRoute = null,
  neighborhoods = [],
  mode = 'fastest',
  loading = false,
  // Compare mode props
  compareMode = false,
  comparisonResult = null,
  loadingCompare = false
}) {
  // AQI lookup map
  const aqiMap = useMemo(() => {
    return new Map(neighborhoods.map((n) => [n.name, n.aqi]));
  }, [neighborhoods]);

  const calculatedAqiExposure = useMemo(() => {
    if (currentRoute?.totalAqiExposure != null) {
      return currentRoute.totalAqiExposure;
    }
    if (!currentRoute?.path || currentRoute.path.length === 0) return 0;
    return currentRoute.path.reduce((sum, name) => sum + (aqiMap.get(name) || 0), 0);
  }, [currentRoute, aqiMap]);

  const calculatedHazardPay = useMemo(() => {
    if (currentRoute?.hazardPay != null) {
      return Number(currentRoute.hazardPay);
    }
    if (calculatedAqiExposure == null || !currentRoute?.totalDistance) return 0;
    const pathLen = currentRoute.path ? currentRoute.path.length : 1;
    const avgAqi = calculatedAqiExposure / pathLen;
    const distanceComponent = (currentRoute.totalDistance || 0) * 1.5;
    const smogSurcharge = Math.max(0, avgAqi - 150) * 0.1;
    return Math.round((distanceComponent + smogSurcharge) * 100) / 100;
  }, [currentRoute, calculatedAqiExposure]);

  const calculatedBypassed = useMemo(() => {
    if (currentRoute?.bypassedCount != null && currentRoute.bypassedCount > 0) {
      return currentRoute.bypassedCount;
    }
    if (mode === 'eco-safe') {
      return neighborhoods.filter((n) => n.aqi > 400 && !n.isWarehouse).length;
    }
    return 0;
  }, [currentRoute, mode, neighborhoods]);

  // --- COMPARE MODE ---
  if (compareMode) {
    if (loadingCompare) {
      return (
        <div className="glass-panel rounded-lg p-4 animate-pulse">
          <div className="h-4 w-32 bg-slate-700/60 rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-800/60 rounded-lg" />
            ))}
          </div>
        </div>
      );
    }

    if (!comparisonResult) {
      return (
        <div className="glass-panel rounded-lg p-4 text-center border border-dashed border-slate-700/80">
          <p className="text-xs text-slate-400 font-medium">
            Click &ldquo;Compare All Modes&rdquo; to see Fastest, Eco-Safe and Risk-Weighted side-by-side.
          </p>
        </div>
      );
    }

    const { fastest, ecoSafe, riskWeighted } = comparisonResult;
    const rows = [
      { label: 'Fastest', key: 'fastest', data: fastest, dotColor: '#ef4444' },
      { label: 'Eco-Safe', key: 'ecoSafe', data: ecoSafe, dotColor: '#10b981' },
      { label: 'Risk-Calibrated', key: 'riskWeighted', data: riskWeighted, dotColor: '#8b5cf6' }
    ];

    // Find best values for highlighting
    const validRows = rows.filter((r) => r.data?.path);
    const bestDist = validRows.length > 0 ? Math.min(...validRows.map((r) => r.data.totalDistance || Infinity)) : null;
    const bestAqi = validRows.length > 0 ? Math.min(...validRows.map((r) => r.data.totalAqiExposure || Infinity)) : null;
    const bestPay = validRows.length > 0 ? Math.min(...validRows.map((r) => r.data.hazardPay || Infinity)) : null;

    return (
      <div className="glass-panel rounded-lg p-4 flex flex-col gap-3 text-slate-200">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Mode Comparison
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            3 routing strategies
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-2 pr-3 font-semibold uppercase text-[10px] tracking-wider">Mode</th>
                <th className="text-right py-2 px-2 font-semibold uppercase text-[10px] tracking-wider">Distance</th>
                <th className="text-right py-2 px-2 font-semibold uppercase text-[10px] tracking-wider">AQI Exposure</th>
                <th className="text-right py-2 pl-2 font-semibold uppercase text-[10px] tracking-wider">Hazard Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => {
                const { data } = row;
                const noPath = !data?.path;
                const dist = data?.totalDistance;
                const aqi = data?.totalAqiExposure;
                const pay = data?.hazardPay;

                return (
                  <tr key={row.key} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.dotColor }}
                        />
                        <span className="font-semibold text-slate-200">{row.label}</span>
                      </div>
                    </td>
                    {noPath ? (
                      <td colSpan={3} className="py-2.5 text-right text-amber-400 italic text-[10px]">
                        No safe path available
                      </td>
                    ) : (
                      <>
                        <td className="py-2.5 px-2 text-right">
                          <span className={`font-mono font-semibold ${dist === bestDist ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {dist != null ? `${dist} km` : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className={`font-mono font-semibold ${aqi === bestAqi ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {aqi != null ? aqi.toLocaleString() : '—'}
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <span className={`font-mono font-semibold ${pay === bestPay ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {pay != null ? `₹${Number(pay).toFixed(2)}` : '—'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          <span className="text-emerald-400 font-semibold">Green</span> = best value in each column.
        </p>
      </div>
    );
  }

  // --- SINGLE ROUTE MODE ---

  // 1. Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="glass-card rounded-lg p-3.5 h-24 flex flex-col justify-between animate-pulse"
          >
            <div className="h-3 w-20 bg-slate-700/60 rounded" />
            <div className="h-7 w-24 bg-slate-700/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // 2. Empty state
  if (!currentRoute) {
    return (
      <div className="glass-panel rounded-lg p-4 text-center border border-dashed border-slate-700/80">
        <p className="text-xs text-slate-400 font-medium">
          Select a warehouse and destination, then calculate a route to view operations telemetry
        </p>
      </div>
    );
  }

  // 3. No safe path
  if (currentRoute.path === null) {
    return (
      <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3.5 text-amber-200 backdrop-blur-md">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 font-bold">
          !
        </div>
        <div>
          <div className="text-sm font-semibold text-amber-300">
            No safe path exists between these points at current AQI levels
          </div>
          <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
            {currentRoute.reason ||
              'All arterial road corridors exceed the 400 AQI safety ceiling. Switch to Risk-Weighted mode to allow controlled dispatch with hazard compensation.'}
          </p>
        </div>
      </div>
    );
  }

  const pathLength = currentRoute.path ? currentRoute.path.length : 0;
  const avgAqiPerNode = currentRoute?.avgAqi != null
    ? currentRoute.avgAqi
    : (pathLength > 0 ? Math.round(calculatedAqiExposure / 5) : 0);
  const riderImpact = currentRoute.riderImpact;

  return (
    <div className="flex flex-col gap-3">
      {/* SLA Warning/Info banners */}
      {currentRoute.slaRelaxed === true && (
        <div className={`rounded-lg border p-3 text-xs flex items-start gap-2.5 ${
          currentRoute.slaAchievable === false
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
        }`}>
          <span className="text-base mt-0.5">
            {currentRoute.slaAchievable === false ? '⚠' : 'ℹ'}
          </span>
          <div>
            {currentRoute.slaAchievable === false ? (
              <>
                <div className="font-semibold text-rose-300">SLA cannot be met — fastest route selected</div>
                <div className="mt-0.5 text-rose-200/80">
                  Fastest route takes {currentRoute.estimatedMinutes} min, which exceeds your {currentRoute.targetMinutes ? `${currentRoute.targetMinutes} min ` : ''}deadline.
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-amber-300">
                  SLA met via auto-relaxed alpha (α = {currentRoute.effectiveAlpha})
                </div>
                <div className="mt-0.5 text-amber-200/80">
                  Estimated transit: <strong>{currentRoute.estimatedMinutes} min</strong> (within {currentRoute.targetMinutes ? `${currentRoute.targetMinutes} min ` : ''}deadline). Pollution penalty lowered to satisfy SLA.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rider cap warning */}
      {riderImpact?.wouldExceedCap && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-lg px-3 py-2.5 text-xs text-rose-200 flex items-center gap-2">
          <span>⚠</span>
          <span>
            This route would push <strong>{riderImpact.riderName}</strong> to{' '}
            {riderImpact.newExposure?.toLocaleString()} AQI pts — exceeding daily cap of{' '}
            {riderImpact.dailyCap?.toLocaleString()}.
          </span>
        </div>
      )}

      {/* Committed confirmation */}
      {riderImpact?.committed && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg px-3 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
          <span>✓</span>
          <span>
            Route committed to <strong>{riderImpact.riderName}</strong>.{' '}
            New exposure: {riderImpact.currentExposure?.toLocaleString()} AQI pts.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Distance */}
        <div className="glass-card rounded-lg p-3.5 flex flex-col justify-between relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Corridor Distance
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {currentRoute.totalDistance != null ? currentRoute.totalDistance : '0'}
            </span>
            <span className="text-xs font-normal text-slate-400 ml-1">km</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {pathLength > 1 ? `${pathLength - 1} road segments` : 'Direct leg'}
          </span>
        </div>

        {/* AQI Exposure */}
        <div className="glass-card rounded-lg p-3.5 flex flex-col justify-between relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              AQI Exposure
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                avgAqiPerNode > 400
                  ? 'bg-rose-500'
                  : avgAqiPerNode > 200
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {calculatedAqiExposure}
            </span>
            <span className="text-xs font-normal text-slate-400 ml-1">AQI pts</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Avg: <strong className="text-slate-200">{avgAqiPerNode}</strong> AQI level
          </span>
        </div>

        {/* Hazard Pay */}
        <div className="glass-card rounded-lg p-3.5 flex flex-col justify-between relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Rider Hazard Pay
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
              ₹{calculatedHazardPay.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            ₹1.50/km + AQI surge bonus
          </span>
        </div>

        {/* Bypassed / Waypoints */}
        <div className="glass-card rounded-lg p-3.5 flex flex-col justify-between relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {mode === 'eco-safe' ? 'Bypassed Hotspots' : 'Route Waypoints'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold font-mono text-emerald-300 tracking-tight">
              {mode === 'eco-safe' ? calculatedBypassed : pathLength}
            </span>
            <span className="text-xs font-normal text-slate-400 ml-1">
              {mode === 'eco-safe' ? 'excluded' : 'nodes'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {mode === 'eco-safe' ? 'Above 400 AQI threshold' : 'Active transit hubs'}
          </span>
        </div>
      </div>
    </div>
  );
}
