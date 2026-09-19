'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Controls from '@/components/Controls';
import MetricsPanel from '@/components/MetricsPanel';

// Dynamically import Leaflet MapView with SSR disabled
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[540px] rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-500">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      <span className="text-xs font-mono">Loading Delhi NCR Spatial Network...</span>
    </div>
  )
});

export default function EcoRouteDashboard() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [roads, setRoads] = useState([]);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState('fastest');
  const [alpha, setAlpha] = useState(1.0);

  const [currentRoute, setCurrentRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingSpike, setLoadingSpike] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Show temporary toast message
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  // 1. Fetch neighborhoods & roads from Neo4j API
  const fetchNeighborhoods = useCallback(async () => {
    try {
      const res = await fetch('/api/neighborhoods');
      if (!res.ok) throw new Error('Failed to fetch neighborhoods');
      const data = await res.json();
      setNeighborhoods(data.neighborhoods || []);
      setRoads(data.roads || []);
      return data.neighborhoods || [];
    } catch (err) {
      console.error('Fetch neighborhoods error:', err);
      showToast('Could not load neighborhoods from database', 'error');
      return [];
    }
  }, []);

  // 2. Compute shortest route
  const calculateRoute = useCallback(
    async (src, tgt, currentMode, currentAlpha) => {
      const activeSrc = src || source;
      const activeTgt = tgt || target;
      const activeMode = currentMode || mode;
      const activeAlpha = currentAlpha !== undefined ? currentAlpha : alpha;

      if (!activeSrc || !activeTgt) return;
      setLoadingRoute(true);
      try {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: activeSrc,
            target: activeTgt,
            mode: activeMode,
            alpha: activeAlpha
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to compute route');
        }

        setCurrentRoute(data);
      } catch (err) {
        console.error('Route calculation error:', err);
        showToast(err.message, 'error');
      } finally {
        setLoadingRoute(false);
      }
    },
    [source, target, mode, alpha]
  );

  // Initial load runs strictly once on mount
  useEffect(() => {
    let isMounted = true;
    async function init() {
      setInitialLoading(true);
      const nodes = await fetchNeighborhoods();
      if (isMounted && nodes.length > 0) {
        const warehouses = nodes.filter((n) => n.isWarehouse);
        const customers = nodes.filter((n) => !n.isWarehouse);

        const defaultSource = warehouses[0]?.name || nodes[0]?.name;
        const defaultTarget = customers[0]?.name || nodes[1]?.name;

        setSource(defaultSource);
        setTarget(defaultTarget);

        await calculateRoute(defaultSource, defaultTarget, 'fastest', 1.0);
      }
      if (isMounted) {
        setInitialLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [fetchNeighborhoods, calculateRoute]);

  // Reactive state handlers
  const handleSourceChange = (newSource) => {
    setSource(newSource);
    calculateRoute(newSource, target, mode, alpha);
  };

  const handleTargetChange = (newTarget) => {
    setTarget(newTarget);
    calculateRoute(source, newTarget, mode, alpha);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    calculateRoute(source, target, newMode, alpha);
  };

  const handleAlphaChange = (newAlpha) => {
    setAlpha(newAlpha);
    calculateRoute(source, target, mode, newAlpha);
  };

  const handleRecalculate = () => {
    calculateRoute(source, target, mode, alpha);
  };

  // 3. Trigger AQI Spike
  const handleTriggerSpike = async () => {
    setLoadingSpike(true);
    try {
      const res = await fetch('/api/spike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to spike AQI');
      }

      await fetchNeighborhoods();
      await calculateRoute(source, target, mode, alpha);

      const spikeList = data.updatedNodes
        ?.map((u) => `${u.name} (${u.oldAqi} ➔ ${u.newAqi} AQI)`)
        .join(', ');

      showToast(`Sensor Spike Recorded: ${spikeList}`, 'warning');
    } catch (err) {
      console.error('Spike error:', err);
      showToast(err.message, 'error');
    } finally {
      setLoadingSpike(false);
    }
  };

  // Summary statistics for ops team header
  const highRiskCount = useMemo(
    () => neighborhoods.filter((n) => n.aqi > 400).length,
    [neighborhoods]
  );

  const avgAqi = useMemo(() => {
    if (!neighborhoods.length) return 0;
    return Math.round(neighborhoods.reduce((sum, n) => sum + n.aqi, 0) / neighborhoods.length);
  }, [neighborhoods]);

  // Check if current route passes through hazardous hotspots
  const hazardousHotspotsOnRoute = useMemo(() => {
    if (mode !== 'fastest' || !currentRoute?.path) return [];
    return currentRoute.path
      .map((name) => neighborhoods.find((n) => n.name === name))
      .filter((n) => n && n.aqi > 400 && n.name !== source && n.name !== target);
  }, [currentRoute?.path, mode, neighborhoods, source, target]);

  return (
    <main className="min-h-screen bg-[#080c15] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Enterprise Navigation Header */}
      <header className="border-b border-slate-800/70 bg-[#0c1220]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-emerald-400 font-black text-sm shadow-sm">
              ER
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white uppercase">
                  EcoRoute <span className="text-slate-400 font-normal">| Delhi NCR</span>
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Dispatch
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                AQI-Aware Delivery Routing & Rider Exposure Mitigation
              </p>
            </div>
          </div>

          {/* Ops Quick Stat Badges */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 text-xs font-mono px-3.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-400">Network:</span>
                <span className="text-slate-200 font-semibold">{neighborhoods.length} Nodes</span>
              </div>
              <div className="h-3 w-px bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Avg AQI:</span>
                <span className={`font-semibold ${avgAqi > 300 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {avgAqi}
                </span>
              </div>
              <div className="h-3 w-px bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Red Zones:</span>
                <span className={`font-semibold ${highRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {highRiskCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[2000] max-w-md">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 text-xs ${
              toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}
          >
            <span className="text-sm font-bold">
              {toast.type === 'warning' ? '!' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <div className="flex-1 font-medium">{toast.message}</div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-5">
        {initialLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[420px] gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-xs font-mono text-slate-400">Syncing spatial topology from Neo4j AuraDB...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Dispatch Controls & Live Smog Monitor (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <Controls
                neighborhoods={neighborhoods}
                source={source}
                setSource={handleSourceChange}
                target={target}
                setTarget={handleTargetChange}
                mode={mode}
                setMode={handleModeChange}
                alpha={alpha}
                setAlpha={handleAlphaChange}
                onRecalculate={handleRecalculate}
                onSpikeTriggered={handleTriggerSpike}
                loading={loadingRoute}
                spikeLoading={loadingSpike}
              />

              {/* High Risk Hotspots Card */}
              <div className="glass-panel rounded-2xl p-4 text-slate-300">
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-800/80">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Severe Smog Concentrations
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">AQI &gt; 250</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {neighborhoods
                    .filter((n) => n.aqi > 250)
                    .sort((a, b) => b.aqi - a.aqi)
                    .map((n) => (
                      <div
                        key={n.name}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[10px]">
                            {n.isWarehouse ? '🏭' : '📍'}
                          </span>
                          <span className="font-medium text-slate-300">
                            {n.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                            {n.zone}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            n.aqi > 400
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {n.aqi} AQI
                        </span>
                      </div>
                    ))}
                  {neighborhoods.filter((n) => n.aqi > 250).length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">
                      All 52 Delhi NCR sensor stations currently reporting moderate AQI (&le; 250).
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Practical Map & Telemetry Analytics (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Alert when Fastest mode routes blindly through a severe AQI smog hotspot */}
              {hazardousHotspotsOnRoute.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold text-rose-400">⚠️</span>
                    <div>
                      <span className="font-semibold text-rose-300">Hazardous Smog Infiltration:</span>
                      <span className="text-slate-300">
                        {' '}Fastest path traverses severe hotspots in{' '}
                        <strong className="text-white">
                          {hazardousHotspotsOnRoute.map((h) => `${h.name} (${h.aqi} AQI)`).join(', ')}
                        </strong>.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleModeChange('eco-safe')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs whitespace-nowrap shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    Reroute Eco-Safe
                  </button>
                </div>
              )}

              {/* Interactive Practical Highway Map */}
              <div className="h-[460px] md:h-[500px] w-full">
                <MapView
                  neighborhoods={neighborhoods}
                  roads={roads}
                  currentRoute={currentRoute}
                  source={source}
                  target={target}
                  mode={mode}
                />
              </div>

              {/* Route & Delivery Performance Metrics */}
              <MetricsPanel
                currentRoute={currentRoute}
                mode={mode}
                source={source}
                target={target}
                loading={loadingRoute}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3.5 px-6 text-center text-[11px] font-mono text-slate-500 bg-[#080c15]">
        EcoRoute • Delhi NCR Winter Smog Mitigation Platform • Next.js App Router • Leaflet • Neo4j AuraDB
      </footer>
    </main>
  );
}
