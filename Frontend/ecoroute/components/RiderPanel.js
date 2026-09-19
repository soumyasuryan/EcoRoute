'use client';

/**
 * RiderPanel — shows all 4 fleet riders with:
 *   - Current exposure / daily cap progress bar
 *   - Warning if near or over cap
 *   - Individual "Reset Shift" button
 *   - "Reset All Shifts" master button
 */
export default function RiderPanel({
  riders = [],
  loading = false,
  onResetRider,
  onResetAll,
  pendingRider = null   // riderName that is being reset (for spinner)
}) {
  const WARNING_PCT = 80; // show warning bar color when >80%

  return (
    <div className="glass-panel rounded-lg p-4 flex flex-col gap-3 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Rider Exposure Budgets
          </h3>
        </div>
        <button
          type="button"
          onClick={onResetAll}
          disabled={loading || riders.length === 0}
          className="text-[10px] font-semibold text-slate-300 bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 hover:text-white px-2.5 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset All Shifts
        </button>
      </div>

      {loading && riders.length === 0 ? (
        <div className="space-y-3 py-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : riders.length === 0 ? (
        <div className="py-3 text-center text-xs text-slate-400 font-medium">
          No riders found — run the seed script to create fleet riders.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {riders.map((rider) => {
            const pct = rider.dailyCap > 0
              ? Math.min(100, Math.round((rider.currentExposure / rider.dailyCap) * 100))
              : 0;
            const isOver = rider.currentExposure > rider.dailyCap;
            const isWarning = pct >= WARNING_PCT;
            const isPending = pendingRider === rider.name;

            const barColor = isOver
              ? 'bg-rose-500'
              : isWarning
              ? 'bg-amber-500'
              : 'bg-blue-500';

            return (
              <div
                key={rider.name}
                className={`bg-slate-900/60 border rounded-lg p-3 transition-all ${
                  isOver
                    ? 'border-rose-500/50 shadow-sm shadow-rose-500/10'
                    : isWarning
                    ? 'border-amber-500/40'
                    : 'border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px]">🚴</span>
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {rider.name}
                    </span>
                    {isOver && (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded-lg shrink-0">
                        OVER CAP
                      </span>
                    )}
                    {isWarning && !isOver && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded-lg shrink-0">
                        HIGH
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onResetRider && onResetRider(rider.name)}
                    disabled={isPending || loading}
                    className="text-[10px] font-medium text-slate-400 hover:text-blue-300 border border-slate-700/60 hover:border-blue-500/50 bg-transparent px-2 py-0.5 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {isPending ? (
                      <svg className="animate-spin h-3 w-3 text-blue-400 inline" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : 'Reset'}
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5 text-[10px] font-mono text-slate-400">
                  <span>
                    <strong className="text-slate-200">{rider.currentExposure.toLocaleString()}</strong>
                    {' / '}
                    {rider.dailyCap.toLocaleString()} AQI pts
                  </span>
                  <span
                    className={`font-semibold ${
                      isOver ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
