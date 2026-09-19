'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Controls from '@/components/Controls';
import MetricsPanel from '@/components/MetricsPanel';

// Dynamically import Leaflet MapView with SSR disabled
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[520px] rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-500">
      <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      <span className="text-sm font-medium">Initializing Delhi NCR Leaflet Canvas...</span>
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

  // 2. Compute shortest route (stable callback with no re-creation on state change)
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

        // Compute initial fastest route
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers for reactive auto-recalculation on parameter change
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

  // Recalculate route manually if requested
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

      // Re-fetch neighborhoods to reflect new AQI values on map
      await fetchNeighborhoods();

      // Automatically recalculate route with new AQI conditions
      await calculateRoute(source, target, mode, alpha);

      const spikeList = data.updatedNodes
        ?.map((u) => `${u.name} (${u.oldAqi} ➔ ${u.newAqi} AQI)`)
        .join(', ');

      showToast(`⚠️ AQI Spike Simulated: ${spikeList}`, 'warning');
    } catch (err) {
      console.error('Spike error:', err);
      showToast(err.message, 'error');
    } finally {
      setLoadingSpike(false);
    }
  };

  // Summary statistics for ops team header
  const highRiskCount = neighborhoods.filter((n) => n.aqi > 400).length;
  const avgAqi = neighborhoods.length
    ? Math.round(neighborhoods.reduce((sum, n) => sum + n.aqi, 0) / neighborhoods.length)
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-400/40">
              <span className="text-xl">🌿</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">
                  EcoRoute <span className="text-emerald-400 font-medium text-sm">| Delhi NCR</span>
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  v1.0 Ops Live
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                AQI-Aware Winter Delivery Routing & Rider Safety Optimization
              </p>
            </div>
          </div>

          {/* Ops Quick Stat Badges */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-xs font-medium px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-400">Neo4j AuraDB:</span>
                <span className="text-slate-200 font-semibold">Active</span>
              </div>
              <div className="h-3.5 w-px bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">City Avg AQI:</span>
                <span className={`font-bold ${avgAqi > 300 ? 'text-red-400' : 'text-amber-400'}`}>
                  {avgAqi}
                </span>
              </div>
              <div className="h-3.5 w-px bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Red Zones (&gt;400):</span>
                <span className={`font-bold ${highRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {highRiskCount} Hubs
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[2000] max-w-md animate-bounce-short">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 text-sm ${
              toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            }`}
          >
            <span className="text-lg">
              {toast.type === 'warning' ? '⚡' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <div className="flex-1 font-medium">{toast.message}</div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6">
        {initialLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400">Connecting to Neo4j AuraDB and querying Delhi NCR network...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Controls and Context (4 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
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
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span>🔥</span> Winter Smog Alerts (Delhi NCR)
                  </h3>
                  <span className="text-[10px] text-slate-500">Live Telemetry</span>
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {neighborhoods
                    .filter((n) => n.aqi > 250)
                    .sort((a, b) => b.aqi - a.aqi)
                    .map((n) => (
                      <div
                        key={n.name}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
                      >
                        <span className="font-semibold text-slate-300">
                          {n.isWarehouse ? '🏭 ' : '📍 '}
                          {n.name}
                        </span>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            n.aqi > 400
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          AQI {n.aqi}
                        </span>
                      </div>
                    ))}
                  {neighborhoods.filter((n) => n.aqi > 250).length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">
                      No severe AQI anomalies detected right now. Click &quot;Trigger AQI Spike&quot; to test.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Map & Performance Metrics (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Alert when Fastest mode routes blindly through a severe AQI smog hotspot */}
              {mode === 'fastest' &&
                (currentRoute?.path || [])
                  .map((name) => neighborhoods.find((n) => n.name === name))
                  .filter((n) => n && n.aqi > 400 && n.name !== source && n.name !== target).length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/60 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200 animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <span className="font-bold text-rose-300 uppercase tracking-wide">Rider Smog Exposure Alert:</span>
                        <span>
                          {' '}Fastest mode routes directly through hazardous smog in{' '}
                          <strong className="text-white underline">
                            {(currentRoute?.path || [])
                              .map((name) => neighborhoods.find((n) => n.name === name))
                              .filter((n) => n && n.aqi > 400 && n.name !== source && n.name !== target)
                              .map((h) => `${h.name} (AQI ${h.aqi})`)
                              .join(', ')}
                          </strong>!
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleModeChange('eco-safe')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold whitespace-nowrap shadow-lg shadow-emerald-950/40 transition-all active:scale-95 text-xs flex items-center gap-1.5"
                    >
                      <span>🛡️</span> Reroute via Eco-Safe
                    </button>
                  </div>
                )}

              {/* Interactive Map */}
              <div className="h-[480px] w-full">
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
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 bg-slate-950">
        EcoRoute Hackathon Project • Winter AQI-Aware Logistics Dashboard • Powered by Next.js, Leaflet & Neo4j AuraDB
      </footer>
    </main>
  );
}
