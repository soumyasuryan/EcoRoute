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
      <div className="glass-panel rounded-2xl p-5 text-center text-slate-400 animate-pulse">
        <div className="text-xs font-mono uppercase tracking-wider">Evaluating optimal transit corridor...</div>
      </div>
    );
  }

  if (!currentRoute) {
    return (
      <div className="glass-panel rounded-2xl p-5 text-center text-slate-400">
        <div className="text-xs">
          Select warehouse origin and customer destination to view live dispatch metrics.
        </div>
      </div>
    );
  }

  // If no path was found (e.g. eco-safe bypassed all links or isolated)
  if (currentRoute.path === null) {
    return (
      <div className="glass-panel border-rose-500/30 rounded-2xl p-5 text-slate-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold shrink-0">
            !
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-rose-400">
                Corridor Dispatch Halted
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                Zero Safe Paths
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {currentRoute.reason ||
                'All arterial road corridors to this destination traverse severe smog hotspots (AQI > 400). In strict Eco-Safe mode, rider safety protocol prohibits transit.'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Recommendation:</span>
              <span className="text-[11px] font-medium text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                Switch to Risk-Calibrated Mode with adjusted α penalty
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const path = currentRoute.path || [];

  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6 flex flex-col gap-4 text-slate-200">
      {/* Title & Mode Indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Dispatch Route Analytics
          </h3>
          <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
            {source} ➔ {target}
          </span>
        </div>
        <span
          className={`text-[10px] font-mono uppercase font-semibold px-2.5 py-1 rounded-full border ${
            mode === 'eco-safe'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : mode === 'risk-weighted'
              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
          }`}
        >
          {mode === 'eco-safe' ? 'Eco-Safe' : mode === 'risk-weighted' ? 'Risk-Calibrated' : 'Fastest'} Mode
        </span>
      </div>

      {/* Grid of Key Performance Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Corridor Distance */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Corridor Distance
          </span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1 tabular-nums">
            {currentRoute.totalDistance}{' '}
            <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Physical network distance</span>
        </div>

        {/* Metric 2: Transit Waypoints */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Corridor Hubs
          </span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1 tabular-nums">
            {path.length}{' '}
            <span className="text-xs font-normal text-slate-400">nodes</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">{path.length > 1 ? path.length - 1 : 0} road legs</span>
        </div>

        {/* Metric 3: Eco-Safe Bypassed Nodes OR Risk-Weighted Exposure */}
        {mode === 'eco-safe' && (
          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              Smog Bypassed
            </span>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-1 tabular-nums">
              {currentRoute.bypassedCount ?? 0}
            </div>
            <span className="text-[10px] text-emerald-400/60 mt-0.5">Hazardous zones avoided</span>
          </div>
        )}

        {mode === 'risk-weighted' && (
          <div className="bg-purple-950/20 border border-purple-800/30 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-medium text-purple-400 uppercase tracking-wider">
              AQI Exposure
            </span>
            <div className="text-xl font-bold font-mono text-purple-300 mt-1 tabular-nums">
              {currentRoute.totalAqiExposure}
            </div>
            <span className="text-[10px] text-purple-400/60 mt-0.5">Cumulative exposure score</span>
          </div>
        )}

        {/* Metric 4: Hazard Pay (risk-weighted) OR Objective */}
        {mode === 'risk-weighted' && (
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
              Rider Hazard Pay
            </span>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1 tabular-nums">
              ₹{Number(currentRoute.hazardPay).toFixed(2)}
            </div>
            <span className="text-[10px] text-amber-400/60 mt-0.5">Health risk incentive</span>
          </div>
        )}

        {mode === 'fastest' && (
          <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-3 flex flex-col col-span-2">
            <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">
              Routing Objective
            </span>
            <div className="text-xs font-semibold text-blue-200 mt-1">
              Minimum Transit Time
            </div>
            <span className="text-[10px] text-blue-400/70 mt-0.5">
              Direct arterial routing without pollution divergence
            </span>
          </div>
        )}

        {mode === 'eco-safe' && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Safety Ceiling
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
              400 <span className="text-xs font-normal text-slate-400">AQI</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Maximum permitted index</span>
          </div>
        )}
      </div>

      {/* Corridor Sector Waypoint Ribbon */}
      <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Active Corridor Checkpoints</span>
          <span className="font-mono text-slate-500">{path.length} sectors</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {path.map((stopName, idx) => (
            <div key={stopName} className="flex items-center gap-1.5">
              <span
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                  idx === 0
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    : idx === path.length - 1
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                {idx === 0 && 'Origin: '}
                {idx === path.length - 1 && 'Drop-off: '}
                {stopName}
              </span>
              {idx < path.length - 1 && (
                <span className="text-slate-600 font-bold text-[10px]">➔</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
