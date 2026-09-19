'use client';

import Sparkline from './Sparkline';

export default function HighRiskPanel({
  highRiskNodes = [],
  loading = false
}) {
  return (
    <div className="glass-panel rounded-lg p-4 flex flex-col gap-3 text-slate-200">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Zones Above Safety Threshold
          </h3>
        </div>
        <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded-lg">
          AQI &gt; 400
        </span>
      </div>

      {loading ? (
        <div className="space-y-2 py-2">
          <div className="h-6 bg-slate-800/60 rounded-lg animate-pulse" />
          <div className="h-6 bg-slate-800/60 rounded-lg animate-pulse" />
        </div>
      ) : highRiskNodes.length === 0 ? (
        <div className="py-3 text-center text-xs text-slate-400 font-medium">
          No zones currently above safety threshold
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 max-h-52 overflow-y-auto pr-1">
          {highRiskNodes.map((node) => (
            <div
              key={node.name}
              className="py-2 flex items-center justify-between text-xs hover:bg-slate-800/30 px-1 rounded transition-colors gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400 font-mono text-[11px] shrink-0">
                  {node.isWarehouse ? '🏭' : '📍'}
                </span>
                <span className="font-medium text-slate-200 truncate">{node.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* AQI Trend Sparkline */}
                {node.aqiHistory && node.aqiHistory.length >= 2 && (
                  <div title={`AQI history: ${node.aqiHistory.join(' → ')}`}>
                    <Sparkline data={node.aqiHistory} width={56} height={18} />
                  </div>
                )}
                <span className="text-[11px] font-semibold text-rose-300 bg-rose-950/70 border border-rose-800/60 px-2.5 py-0.5 rounded-lg font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{node.aqi} AQI</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
