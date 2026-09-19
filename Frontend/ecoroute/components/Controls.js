'use client';

import { useMemo } from 'react';

export default function Controls({
  neighborhoods = [],
  source = '',
  setSource,
  target = '',
  setTarget,
  mode = 'fastest',
  setMode,
  alpha = 1.0,
  setAlpha,
  onCalculate,
  onSpikeTriggered,
  loading = false,
  spikeLoading = false,
  // Compare mode
  compareMode = false,
  setCompareMode,
  onCompare,
  loadingCompare = false,
  // Rider assignment
  riders = [],
  selectedRiderId = '',
  setSelectedRiderId,
  // SLA
  maxDeliveryMinutes = '',
  setMaxDeliveryMinutes,
  // Commit / Preview
  previewRoute = null,
  onCommitRoute,
  loadingCommit = false
}) {
  const warehouses = useMemo(
    () => neighborhoods.filter((n) => n.isWarehouse),
    [neighborhoods]
  );
  const destinations = useMemo(
    () => neighborhoods.filter((n) => !n.isWarehouse),
    [neighborhoods]
  );

  const groupedDestinations = useMemo(() => {
    const groups = {};
    destinations.forEach((d) => {
      const z = d.zone || 'Other Hubs';
      if (!groups[z]) groups[z] = [];
      groups[z].push(d);
    });
    return groups;
  }, [destinations]);

  const riderImpact = previewRoute?.riderImpact;
  const showCommitButton = !!selectedRiderId && !!previewRoute?.path;

  return (
    <div className="glass-panel rounded-lg p-5 flex flex-col gap-4 text-slate-200">
      {/* Card Header */}
      <div className="border-b border-slate-700/60 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 live-beacon" />
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
              Route Planner
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure origin, destination &amp; dispatch criteria
          </p>
        </div>
        <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-lg">
          {neighborhoods.length} nodes
        </span>
      </div>

      {/* Origin & Destination Selectors */}
      <div className="flex flex-col gap-3">
        {/* Warehouse Dropdown */}
        <div>
          <label
            htmlFor="warehouse-select"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 flex items-center justify-between"
          >
            <span>Warehouse Origin</span>
            <span className="text-[10px] font-mono text-blue-400 uppercase bg-blue-950/60 border border-blue-800/50 px-1.5 py-0.2 rounded">
              Hub
            </span>
          </label>
          <div className="relative">
            <select
              id="warehouse-select"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full appearance-none bg-slate-900/90 border border-slate-700/80 text-white text-xs rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              {warehouses.length === 0 ? (
                <option value="">No warehouses available</option>
              ) : (
                warehouses.map((w) => (
                  <option key={w.name} value={w.name} className="bg-slate-900 text-slate-100">
                    🏭 {w.name} (AQI {w.aqi})
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Destination Dropdown */}
        <div>
          <label
            htmlFor="destination-select"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 flex items-center justify-between"
          >
            <span>Customer Drop-off</span>
            <span className="text-[10px] font-mono text-emerald-400 uppercase bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.2 rounded">
              Destination
            </span>
          </label>
          <div className="relative">
            <select
              id="destination-select"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full appearance-none bg-slate-900/90 border border-slate-700/80 text-white text-xs rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium cursor-pointer"
            >
              {Object.keys(groupedDestinations).length === 0 ? (
                <option value="">No destinations available</option>
              ) : (
                Object.entries(groupedDestinations).map(([zoneName, items]) => (
                  <optgroup key={zoneName} label={zoneName} className="bg-slate-950 text-slate-400 font-semibold">
                    {items.map((d) => (
                      <option key={d.name} value={d.name} className="bg-slate-900 text-slate-100">
                        📍 {d.name} (AQI {d.aqi})
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Compare Mode Toggle */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5">
        <div>
          <div className="text-xs font-semibold text-slate-200">Side-by-Side Comparison</div>
          <div className="text-[10px] text-slate-400 mt-0.5">All 3 modes in parallel</div>
        </div>
        <button
          type="button"
          id="compare-mode-toggle"
          onClick={() => setCompareMode && setCompareMode(!compareMode)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
            compareMode ? 'bg-blue-600' : 'bg-slate-700'
          }`}
          role="switch"
          aria-checked={compareMode}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              compareMode ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Mode Selector: shown only when NOT in compare mode */}
      {!compareMode && (
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
            Routing Mode
          </label>
          <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('fastest')}
              className={`py-2 text-xs font-medium rounded-lg text-center transition-all cursor-pointer ${
                mode === 'fastest'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Fastest
            </button>
            <button
              type="button"
              onClick={() => setMode('eco-safe')}
              className={`py-2 text-xs font-medium rounded-lg text-center transition-all cursor-pointer ${
                mode === 'eco-safe'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Eco-Safe
            </button>
            <button
              type="button"
              onClick={() => setMode('risk-weighted')}
              className={`py-2 text-xs font-medium rounded-lg text-center transition-all cursor-pointer ${
                mode === 'risk-weighted'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Risk-Calibrated
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
            {mode === 'fastest' && 'Direct arterial transit minimizing driving distance.'}
            {mode === 'eco-safe' && (
              <>
                Strictly excludes zones exceeding AQI 400.
                {previewRoute && (previewRoute.bypassedCount === 0 || previewRoute.bypassedCount == null) && (
                  <span className="block text-[10px] text-emerald-400/90 mt-0.5 font-medium">
                    ✓ All nodes along corridor are currently under 400 AQI (corridor is already safe).
                  </span>
                )}
              </>
            )}
            {mode === 'risk-weighted' && 'Mathematical balance between mileage and rider AQI exposure.'}
          </p>
        </div>
      )}

      {/* Alpha Slider: Risk-Weighted mode only */}
      {!compareMode && mode === 'risk-weighted' && (
        <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-3 flex flex-col gap-2 transition-all">
          <div className="flex items-center justify-between">
            <label htmlFor="alpha-input" className="text-xs font-semibold text-slate-300">
              Pollution Penalty (α)
            </label>
            <span className="text-xs font-mono font-bold text-blue-300 bg-blue-950/80 border border-blue-700/60 px-2 py-0.5 rounded-lg">
              α = {Number(alpha).toFixed(1)}
            </span>
          </div>
          <input
            id="alpha-input"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0.0 (Speed)</span>
            <span>1.0 (Balanced)</span>
            <span>2.0 (Air)</span>
          </div>
        </div>
      )}

      {/* Max Delivery Time (SLA): Risk-Weighted only, no compare mode */}
      {!compareMode && mode === 'risk-weighted' && (
        <div>
          <label
            htmlFor="max-delivery-minutes"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5"
          >
            Max Delivery Time
          </label>
          <div className="relative">
            <input
              id="max-delivery-minutes"
              type="number"
              min="1"
              max="240"
              placeholder="e.g. 60"
              value={maxDeliveryMinutes}
              onChange={(e) => setMaxDeliveryMinutes && setMaxDeliveryMinutes(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 text-white text-xs rounded-lg px-3 py-2.5 pr-14 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[11px] text-slate-400 font-mono">
              min
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-snug">
            Alpha steps down automatically to meet SLA deadline.
          </p>
        </div>
      )}

      {/* Rider Assignment Dropdown: hidden in compare mode */}
      {!compareMode && riders.length > 0 && (
        <div>
          <label
            htmlFor="rider-select"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5"
          >
            Assign to Rider
          </label>
          <div className="relative">
            <select
              id="rider-select"
              value={selectedRiderId}
              onChange={(e) => setSelectedRiderId && setSelectedRiderId(e.target.value)}
              className="w-full appearance-none bg-slate-900/90 border border-slate-700/80 text-white text-xs rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium cursor-pointer"
            >
              <option value="">— No rider selected —</option>
              {riders.map((r) => {
                const pct = r.dailyCap > 0
                  ? Math.round((r.currentExposure / r.dailyCap) * 100)
                  : 0;
                return (
                  <option key={r.name} value={r.name} className="bg-slate-900 text-slate-100">
                    🚴 {r.name} ({pct}% used)
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {selectedRiderId && (
            <p className="text-[10px] text-slate-500 mt-1">
              Preview route first — commit only when ready to dispatch.
            </p>
          )}
        </div>
      )}

      {/* Rider Impact Preview Banner */}
      {riderImpact && !riderImpact.committed && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            riderImpact.wouldExceedCap
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              : 'bg-blue-950/30 border-blue-500/40 text-blue-200'
          }`}
        >
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            {riderImpact.wouldExceedCap ? (
              <>
                <span>⚠</span>
                <span>Cap exceeded after dispatch</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>Rider budget OK</span>
              </>
            )}
          </div>
          <div className="font-mono text-[10px] text-slate-300 space-y-0.5">
            <div>Route exposure: <strong>{riderImpact.routeExposure?.toLocaleString()} AQI pts</strong></div>
            <div>
              New total: <strong>{riderImpact.newExposure?.toLocaleString()}</strong>
              {' / '}{riderImpact.dailyCap?.toLocaleString()} ({riderImpact.budgetUsagePercent}% of cap)
            </div>
          </div>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex flex-col gap-2.5 pt-1">
        {compareMode ? (
          /* Compare All Modes Button */
          <button
            type="button"
            id="compare-all-modes-btn"
            onClick={onCompare}
            disabled={loadingCompare || !source || !target}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingCompare ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span>Computing All Routes...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Compare All Modes</span>
              </>
            )}
          </button>
        ) : (
          /* Preview / Calculate Route Button */
          <button
            type="button"
            id="calculate-route-btn"
            onClick={onCalculate}
            disabled={loading || !source || !target}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span>Computing Route...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>{selectedRiderId ? 'Preview Route' : 'Calculate Route'}</span>
              </>
            )}
          </button>
        )}

        {/* Commit to Rider — shown only after preview with a rider selected */}
        {showCommitButton && !compareMode && (
          <button
            type="button"
            id="commit-route-btn"
            onClick={onCommitRoute}
            disabled={loadingCommit}
            className="w-full py-2 px-3 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-500/60 text-white font-semibold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loadingCommit ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span>Committing...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Assign to {selectedRiderId.split(' (')[0]}</span>
              </>
            )}
          </button>
        )}

        {/* Divider */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-semibold text-slate-500">
            <span className="bg-[#0f172a] px-2">Simulation Engine</span>
          </div>
        </div>

        {/* Simulate AQI Spike */}
        <button
          type="button"
          id="simulate-spike-btn"
          onClick={onSpikeTriggered}
          disabled={spikeLoading}
          className="w-full py-2 px-3 rounded-lg bg-red-950/20 hover:bg-red-950/40 border border-red-500/40 hover:border-red-500/70 text-red-300 font-semibold text-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {spikeLoading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-red-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span>Injecting AQI Spike...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Simulate AQI Spike</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
