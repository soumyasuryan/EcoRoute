'use client';

import { useState } from 'react';

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
  const [spikeNotice, setSpikeNotice] = useState(null);

  // Filter sources (only Warehouses) and targets (non-warehouses)
  const warehouses = neighborhoods.filter((n) => n.isWarehouse);
  const destinations = neighborhoods.filter((n) => !n.isWarehouse);

  const handleSpikeClick = async () => {
    try {
      if (onSpikeTriggered) {
        await onSpikeTriggered();
      }
    } catch (err) {
      console.error('Error triggering spike:', err);
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-xl flex flex-col gap-6 text-slate-100">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400">⚡</span> Route Dispatch Controls
          </h2>
          <p className="text-xs text-slate-400">
            Configure delivery origin, destination & AQI sensitivity
          </p>
        </div>
      </div>

      {/* Origin & Destination Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Dropdown (Warehouses only) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Warehouse Origin</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Warehouses
            </span>
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          >
            {warehouses.map((w) => (
              <option key={w.name} value={w.name}>
                🏭 {w.name} (AQI: {w.aqi})
              </option>
            ))}
          </select>
        </div>

        {/* Target Dropdown (Destination neighborhoods) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Customer Dropoff</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
              Neighborhood
            </span>
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          >
            {destinations.map((d) => (
              <option key={d.name} value={d.name}>
                📍 {d.name} (AQI: {d.aqi})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Routing Mode Radio Group */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Routing Strategy
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Fastest Mode */}
          <label
            className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
              mode === 'fastest'
                ? 'bg-blue-950/40 border-blue-500 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <input
                type="radio"
                name="routeMode"
                value="fastest"
                checked={mode === 'fastest'}
                onChange={() => setMode('fastest')}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="text-blue-400 font-semibold">Fastest</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 pl-5">
              Pure physical distance minimization
            </span>
          </label>

          {/* Eco-Safe Mode */}
          <label
            className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
              mode === 'eco-safe'
                ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <input
                type="radio"
                name="routeMode"
                value="eco-safe"
                checked={mode === 'eco-safe'}
                onChange={() => setMode('eco-safe')}
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-emerald-400 font-semibold">Eco-Safe</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 pl-5">
              Zero tolerance: bypass all nodes with AQI &gt; 400
            </span>
          </label>

          {/* Risk-Weighted Mode */}
          <label
            className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
              mode === 'risk-weighted'
                ? 'bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-500/10 ring-1 ring-purple-500'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <input
                type="radio"
                name="routeMode"
                value="risk-weighted"
                checked={mode === 'risk-weighted'}
                onChange={() => setMode('risk-weighted')}
                className="text-purple-500 focus:ring-purple-500"
              />
              <span className="text-purple-400 font-semibold">Risk-Weighted</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 pl-5">
              Balances road distance with rider AQI exposure
            </span>
          </label>
        </div>
      </div>

      {/* Alpha Slider (Rendered only when Risk-Weighted mode is active) */}
      {mode === 'risk-weighted' && (
        <div className="bg-purple-950/20 border border-purple-900/40 rounded-xl p-4 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Exposure Penalty Coefficient (α)</span>
            </label>
            <span className="text-xs font-mono font-bold bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">
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
            className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
            <span>0.0 (Prioritize Speed)</span>
            <span>1.0 (Balanced)</span>
            <span>2.0 (Strict Clean Air)</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onRecalculate}
          disabled={loading || !source || !target}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <span>Recalculating...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>Recalculate Route</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSpikeClick}
          disabled={spikeLoading}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm shadow-lg shadow-red-950/50 transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {spikeLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              <span>Spiking AQI...</span>
            </>
          ) : (
            <>
              <span className="text-yellow-300">⚡</span>
              <span>Trigger AQI Spike</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
