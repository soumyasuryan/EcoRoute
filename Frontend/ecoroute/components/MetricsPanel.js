'use client';

export default function MetricsPanel({
  currentRoute = null,
  mode = 'fastest',
  source = '',
  target = '',
  loading = false
}) {
  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl text-center text-slate-400 animate-pulse">
        <div className="text-sm font-medium">Computing optimal route...</div>
      </div>
    );
  }

  if (!currentRoute) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl text-center text-slate-400">
        <div className="text-sm font-medium">
          Select an origin and destination above, then click &quot;Recalculate Route&quot; to inspect logistics metrics.
        </div>
      </div>
    );
  }

  // If no path was found (e.g. eco-safe bypassed all links or isolated)
  if (currentRoute.path === null) {
    return (
      <div className="bg-red-950/30 border border-red-500/50 rounded-2xl p-6 shadow-xl text-slate-200">
        <div className="flex items-start gap-3">
          <div className="text-2xl text-red-400">⚠️</div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-red-400">
              No Safe Path Exists
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {currentRoute.reason ||
                'All available paths traverse hazardous zones where AQI exceeds 400. In strict Eco-Safe mode, rider dispatch is temporarily halted along this corridor.'}
            </p>
            {currentRoute.bypassedCount > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-900/40 border border-red-800/60 text-xs text-red-300 font-semibold">
                <span>🛡️</span>
                <span>{currentRoute.bypassedCount} Hazardous Hubs Bypassed</span>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2 italic">
              Tip: Switch to &quot;Risk-Weighted&quot; mode or &quot;Fastest&quot; to evaluate calibrated transit options with rider hazard pay.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const path = currentRoute.path || [];

  return (
    <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col gap-5 text-slate-100">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>📊</span> Route Dispatch Metrics
          </h3>
          <span className="text-xs text-slate-400">
            {source} ➔ {target} ({path.length} stops)
          </span>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
            mode === 'eco-safe'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : mode === 'risk-weighted'
              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
          }`}
        >
          {mode} Mode
        </span>
      </div>

      {/* Grid of Key Performance Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Metric 1: Total Distance */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Distance
          </span>
          <div className="text-2xl font-black text-white mt-1">
            {currentRoute.totalDistance}{' '}
            <span className="text-xs font-semibold text-slate-400">km</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Physical road length</span>
        </div>

        {/* Metric 2: Waypoint Count */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Waypoints
          </span>
          <div className="text-2xl font-black text-white mt-1">
            {path.length}{' '}
            <span className="text-xs font-semibold text-slate-400">nodes</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">{path.length - 1} transit legs</span>
        </div>

        {/* Metric 3: Eco-Safe Bypassed Nodes OR Risk-Weighted Exposure */}
        {mode === 'eco-safe' && (
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5 flex flex-col">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Bypassed Hubs
            </span>
            <div className="text-2xl font-black text-emerald-300 mt-1">
              {currentRoute.bypassedCount ?? 0}
            </div>
            <span className="text-[10px] text-emerald-400/70 mt-1">
              Hazardous zones excluded
            </span>
          </div>
        )}

        {mode === 'risk-weighted' && (
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-3.5 flex flex-col">
            <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider">
              AQI Exposure
            </span>
            <div className="text-2xl font-black text-purple-300 mt-1">
              {currentRoute.totalAqiExposure}
            </div>
            <span className="text-[10px] text-purple-400/70 mt-1">
              Cumulative rider index
            </span>
          </div>
        )}

        {/* Metric 4: Hazard Pay (only if risk-weighted) */}
        {mode === 'risk-weighted' && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3.5 flex flex-col">
            <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
              Est. Hazard Pay
            </span>
            <div className="text-2xl font-black text-amber-300 mt-1">
              ₹{Number(currentRoute.hazardPay).toFixed(2)}
            </div>
            <span className="text-[10px] text-amber-400/70 mt-1">
              Rider health incentive
            </span>
          </div>
        )}

        {mode === 'fastest' && (
          <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-3.5 flex flex-col col-span-2">
            <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">
              Routing Objective
            </span>
            <div className="text-sm font-semibold text-blue-200 mt-1">
              Shortest Path Optimization
            </div>
            <span className="text-[10px] text-blue-400/70 mt-1">
              Ignores winter smog concentrations to achieve minimum transit time
            </span>
          </div>
        )}
      </div>

      {/* Path Breadcrumbs / Waypoint chain */}
      <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>🗺️</span> Active Corridor Path
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {path.map((stopName, idx) => (
            <div key={stopName} className="flex items-center gap-1.5">
              <span
                className={`px-2.5 py-1 rounded-lg font-medium border ${
                  idx === 0
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : idx === path.length - 1
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                    : 'bg-slate-800/70 text-slate-300 border-slate-700/60'
                }`}
              >
                {idx === 0 && '🏭 '}
                {idx === path.length - 1 && '🏁 '}
                {stopName}
              </span>
              {idx < path.length - 1 && (
                <span className="text-slate-500 font-bold">➔</span>
              )}
            </div>
          ))}
        </div>
        {mode === 'risk-weighted' && (
          <div className="mt-2 text-[10px] text-slate-500 italic">
            * Note: Hazard pay is calculated as totalAqiExposure × ₹0.50 (illustrative mock formula for hackathon demonstration).
          </div>
        )}
      </div>
    </div>
  );
}
