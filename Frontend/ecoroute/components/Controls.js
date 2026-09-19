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
  onRecalculate,
  onSpikeTriggered,
  loading = false,
  spikeLoading = false
}) {
  // Separate Warehouses and Destinations
  const warehouses = useMemo(() => neighborhoods.filter((n) => n.isWarehouse), [neighborhoods]);
  const destinations = useMemo(() => neighborhoods.filter((n) => !n.isWarehouse), [neighborhoods]);

  // Group destinations by Zone for clean dropdown organization
  const groupedDestinations = useMemo(() => {
    const groups = {};
    destinations.forEach((d) => {
      const z = d.zone || 'Other Hubs';
      if (!groups[z]) groups[z] = [];
      groups[z].push(d);
    });
    return groups;
  }, [destinations]);

  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6 flex flex-col gap-5 text-slate-200">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
              Dispatch Control Deck
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Select logistics origin, destination & routing criteria
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
          {neighborhoods.length} Active Nodes
        </span>
      </div>

      {/* Origin & Destination Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Source Dropdown (Warehouses) */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Fulfillment Warehouse</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Origin
            </span>
          </label>
          <div className="relative">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full appearance-none bg-slate-950/80 border border-slate-700/70 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium cursor-pointer"
            >
              {warehouses.map((w) => (
                <option key={w.name} value={w.name} className="bg-slate-900 text-slate-100 py-1">
                  🏭 {w.name} (AQI: {w.aqi})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Target Dropdown (Grouped Customer Destinations) */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Customer Drop-off</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Destination
            </span>
          </label>
          <div className="relative">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full appearance-none bg-slate-950/80 border border-slate-700/70 text-slate-100 text-xs rounded-xl px-3.5 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium cursor-pointer"
            >
              {Object.entries(groupedDestinations).map(([zoneName, items]) => (
                <optgroup key={zoneName} label={zoneName} className="bg-slate-950 text-slate-400 font-semibold">
                  {items.map((d) => (
                    <option key={d.name} value={d.name} className="bg-slate-900 text-slate-100 py-1">
                      📍 {d.name} (AQI: {d.aqi})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Routing Strategy Toggle Cards */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">
          Optimization Strategy
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 1. Fastest */}
          <button
            type="button"
            onClick={() => setMode('fastest')}
            className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              mode === 'fastest'
                ? 'bg-blue-500/10 border-blue-500/80 text-white shadow-sm ring-1 ring-blue-500/50'
                : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-950/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${mode === 'fastest' ? 'text-blue-300' : 'text-slate-300'}`}>
                Fastest Route
              </span>
              <span className={`w-2 h-2 rounded-full ${mode === 'fastest' ? 'bg-blue-400' : 'bg-slate-600'}`}></span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 leading-snug">
              Direct arterial transit minimizing driving distance & duration.
            </span>
          </button>

          {/* 2. Eco-Safe */}
          <button
            type="button"
            onClick={() => setMode('eco-safe')}
            className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              mode === 'eco-safe'
                ? 'bg-emerald-500/10 border-emerald-500/80 text-white shadow-sm ring-1 ring-emerald-500/50'
                : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-950/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${mode === 'eco-safe' ? 'text-emerald-300' : 'text-slate-300'}`}>
                Eco-Safe Corridor
              </span>
              <span className={`w-2 h-2 rounded-full ${mode === 'eco-safe' ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 leading-snug">
              Bypasses severe smog hotspots (AQI &gt; 400) for rider health.
            </span>
          </button>

          {/* 3. Risk-Weighted */}
          <button
            type="button"
            onClick={() => setMode('risk-weighted')}
            className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              mode === 'risk-weighted'
                ? 'bg-purple-500/10 border-purple-500/80 text-white shadow-sm ring-1 ring-purple-500/50'
                : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-950/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${mode === 'risk-weighted' ? 'text-purple-300' : 'text-slate-300'}`}>
                Risk-Calibrated
              </span>
              <span className={`w-2 h-2 rounded-full ${mode === 'risk-weighted' ? 'bg-purple-400' : 'bg-slate-600'}`}></span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 leading-snug">
              Mathematical trade-off between mileage and AQI hazard cost.
            </span>
          </button>
        </div>
      </div>

      {/* Alpha Slider (Risk-Weighted Mode) */}
      {mode === 'risk-weighted' && (
        <div className="bg-purple-950/20 border border-purple-800/30 rounded-xl p-3.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-purple-300 flex items-center gap-1.5">
              <span>Pollution Penalty Coefficient (α)</span>
            </label>
            <span className="text-xs font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
              α = {Number(alpha).toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
            <span>0.0 (Prioritize Speed)</span>
            <span>1.0 (Balanced)</span>
            <span>2.0 (Strict Clean Air)</span>
          </div>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
        <button
          type="button"
          onClick={onRecalculate}
          disabled={loading || !source || !target}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-900 font-semibold text-xs transition-all shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-slate-900" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <span>Computing Route...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Recalculate Route</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onSpikeTriggered}
          disabled={spikeLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-rose-300 font-semibold text-xs transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {spikeLoading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <span>Spiking Stations...</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
              <span>Trigger AQI Spike</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
