'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Controls from '@/components/Controls';
import MetricsPanel from '@/components/MetricsPanel';
import HighRiskPanel from '@/components/HighRiskPanel';
import RiderPanel from '@/components/RiderPanel';

// Dynamically import Leaflet MapView with SSR disabled
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs font-mono">
      Loading Delhi NCR Spatial Network...
    </div>
  )
});

export default function EcoRouteDashboard() {
  // --- Core data ---
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [roads, setRoads] = useState([]);
  const [highRiskNodes, setHighRiskNodes] = useState([]);
  const [riders, setRiders] = useState([]);

  // --- Route inputs ---
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState('fastest');
  const [alpha, setAlpha] = useState(1.0);
  const [maxDeliveryMinutes, setMaxDeliveryMinutes] = useState('');
  const [selectedRiderId, setSelectedRiderId] = useState('');

  // --- Route output ---
  const [currentRoute, setCurrentRoute] = useState(null);

  // --- Compare mode ---
  const [compareMode, setCompareMode] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);

  // --- Loading flags ---
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingSpike, setLoadingSpike] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [pendingRider, setPendingRider] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [toast, setToast] = useState(null);

  // Toast helper
  const showToast = useCallback((message, borderColor = 'border-blue-500') => {
    setToast({ message, borderColor });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const getNowTimeString = () =>
    new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

  // ── Fetch helpers ───────────────────────────────────────────────────────────

  const fetchHighRiskNodes = useCallback(async () => {
    try {
      const res = await fetch('/api/high-risk');
      if (!res.ok) return;
      const data = await res.json();
      setHighRiskNodes(data.highRiskNodes || []);
    } catch (err) {
      console.error('Fetch high-risk nodes error:', err);
    }
  }, []);

  const fetchRiders = useCallback(async () => {
    try {
      const res = await fetch('/api/riders');
      if (!res.ok) return;
      const data = await res.json();
      setRiders(data.riders || []);
    } catch (err) {
      console.error('Fetch riders error:', err);
    }
  }, []);

  const fetchNeighborhoods = useCallback(async () => {
    try {
      const res = await fetch('/api/neighborhoods');
      if (!res.ok) throw new Error('Failed to fetch neighborhoods');
      const data = await res.json();
      const nodes = data.neighborhoods || [];
      setNeighborhoods(nodes);
      setRoads(data.roads || []);
      setLastUpdated(getNowTimeString());
      return nodes;
    } catch (err) {
      console.error('Fetch neighborhoods error:', err);
      showToast('Could not load neighborhood data', 'border-red-500');
      return [];
    }
  }, [showToast]);

  // ── Route calculation ──────────────────────────────────────────────────────

  const calculateRoute = useCallback(
    async (src, tgt, currentMode, currentAlpha, currentMaxMins, currentRiderId, showRecalculatedToast = true) => {
      if (!src || !tgt) return;
      setLoadingRoute(true);
      try {
        const body = {
          source: src,
          target: tgt,
          mode: currentMode,
          alpha: currentAlpha,
          commit: false
        };
        if (currentRiderId) body.riderId = currentRiderId;
        if (currentMaxMins && !isNaN(Number(currentMaxMins)) && Number(currentMaxMins) > 0) {
          body.maxDeliveryMinutes = Number(currentMaxMins);
        }

        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to compute route');

        setCurrentRoute(data);
        if (showRecalculatedToast) {
          showToast('Route recalculated', 'border-blue-500');
        }
        await fetchHighRiskNodes();
      } catch (err) {
        console.error('Route calculation error:', err);
        showToast(err.message || 'Route calculation failed', 'border-red-500');
      } finally {
        setLoadingRoute(false);
      }
    },
    [showToast, fetchHighRiskNodes]
  );

  // ── Compare mode calculation ───────────────────────────────────────────────

  const handleCompareWith = useCallback(
    async (src = source, tgt = target, currentAlpha = alpha, showToastMsg = true) => {
      if (!src || !tgt) return;
      setLoadingCompare(true);
      try {
        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: src, target: tgt, alpha: currentAlpha })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to compare routes');
        setComparisonResult(data);
        await fetchHighRiskNodes();
        if (showToastMsg) {
          showToast('All 3 modes compared', 'border-blue-500');
        }
      } catch (err) {
        console.error('Compare error:', err);
        showToast(err.message || 'Comparison failed', 'border-red-500');
      } finally {
        setLoadingCompare(false);
      }
    },
    [source, target, alpha, fetchHighRiskNodes, showToast]
  );

  const handleCompare = useCallback(async () => {
    await handleCompareWith(source, target, alpha, true);
  }, [handleCompareWith, source, target, alpha]);

  // ── Commit route to rider ─────────────────────────────────────────────────

  const handleCommitRoute = useCallback(async () => {
    if (!selectedRiderId || !currentRoute?.path) return;
    setLoadingCommit(true);
    try {
      const body = {
        source,
        target,
        mode,
        alpha,
        riderId: selectedRiderId,
        commit: true
      };
      if (maxDeliveryMinutes && !isNaN(Number(maxDeliveryMinutes)) && Number(maxDeliveryMinutes) > 0) {
        body.maxDeliveryMinutes = Number(maxDeliveryMinutes);
      }

      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to commit route');

      setCurrentRoute(data);
      await fetchRiders();
      showToast(`Route committed to ${selectedRiderId.split(' (')[0]}`, 'border-emerald-500');
    } catch (err) {
      console.error('Commit error:', err);
      showToast(err.message || 'Commit failed', 'border-red-500');
    } finally {
      setLoadingCommit(false);
    }
  }, [selectedRiderId, currentRoute, source, target, mode, alpha, maxDeliveryMinutes, fetchRiders, showToast]);

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;
    async function init() {
      setInitialLoading(true);
      const [nodes] = await Promise.all([
        fetchNeighborhoods(),
        fetchHighRiskNodes(),
        fetchRiders()
      ]);
      if (isMounted && nodes.length > 0) {
        const warehouses = nodes.filter((n) => n.isWarehouse);
        const customers = nodes.filter((n) => !n.isWarehouse);
        setSource(warehouses[0]?.name || nodes[0]?.name);
        setTarget(customers[0]?.name || nodes[1]?.name);
      }
      if (isMounted) setInitialLoading(false);
    }
    init();
    return () => { isMounted = false; };
  }, [fetchNeighborhoods, fetchHighRiskNodes, fetchRiders]);

  // ── Auto-recalculate on input change ─────────────────────────────────────────

  const handleSourceChange = (newSource) => {
    setSource(newSource);
    if (compareMode) {
      handleCompareWith(newSource, target, alpha, false);
    } else if (currentRoute) {
      calculateRoute(newSource, target, mode, alpha, maxDeliveryMinutes, selectedRiderId, true);
    }
  };

  const handleTargetChange = (newTarget) => {
    setTarget(newTarget);
    if (compareMode) {
      handleCompareWith(source, newTarget, alpha, false);
    } else if (currentRoute) {
      calculateRoute(source, newTarget, mode, alpha, maxDeliveryMinutes, selectedRiderId, true);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (currentRoute) {
      calculateRoute(source, target, newMode, alpha, maxDeliveryMinutes, selectedRiderId, true);
    }
  };

  const handleAlphaChange = (newAlpha) => {
    setAlpha(newAlpha);
    if (compareMode) {
      handleCompareWith(source, target, newAlpha, false);
    } else if (currentRoute || (source && target)) {
      calculateRoute(source, target, mode, newAlpha, maxDeliveryMinutes, selectedRiderId, false);
    }
  };

  const handleRiderChange = (newRiderId) => {
    setSelectedRiderId(newRiderId);
    if (currentRoute) {
      calculateRoute(source, target, mode, alpha, maxDeliveryMinutes, newRiderId, false);
    }
  };

  const handleMaxDeliveryMinutesChange = (newMinutes) => {
    setMaxDeliveryMinutes(newMinutes);
    if (currentRoute && mode === 'risk-weighted') {
      calculateRoute(source, target, mode, alpha, newMinutes, selectedRiderId, false);
    }
  };

  // When compare mode is toggled, auto-trigger compare immediately!
  const handleCompareModeToggle = (val) => {
    setCompareMode(val);
    if (val) {
      setCurrentRoute(null);
      handleCompareWith(source, target, alpha, true);
    } else {
      setComparisonResult(null);
      if (source && target) {
        calculateRoute(source, target, mode, alpha, maxDeliveryMinutes, selectedRiderId, false);
      }
    }
  };

  const handleCalculate = () => {
    calculateRoute(source, target, mode, alpha, maxDeliveryMinutes, selectedRiderId, true);
  };

  // ── AQI Spike ─────────────────────────────────────────────────────────────

  const handleTriggerSpike = async () => {
    setLoadingSpike(true);
    try {
      const res = await fetch('/api/spike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger AQI spike');

      // 1. Refresh neighborhood AQI values on the map
      await fetchNeighborhoods();
      await fetchHighRiskNodes();

      // 2. Always recalculate route if source & target are selected — regardless of prior route existence
      if (compareMode && comparisonResult) {
        await handleCompare();
      } else if (source && target) {
        await calculateRoute(source, target, mode, alpha, maxDeliveryMinutes, selectedRiderId, false);
      }

      // 3. Notify which nodes were spiked
      const spikedNames = data.updatedNodes
        ?.filter((n) => n.isSpike)
        .map((n) => `${n.name} → AQI ${n.newAqi}`)
        .join(', ');
      const count = data.updatedNodes?.length || 0;
      const spikeMsg = spikedNames
        ? `⚡ Smog spike: ${spikedNames}`
        : `AQI spike triggered — ${count} zones updated`;
      showToast(spikeMsg, 'border-amber-500');
    } catch (err) {
      console.error('Spike error:', err);
      showToast(err.message || 'Failed to simulate spike', 'border-red-500');
    } finally {
      setLoadingSpike(false);
    }
  };

  // ── Rider management ──────────────────────────────────────────────────────

  const handleResetRider = async (riderName) => {
    setPendingRider(riderName);
    try {
      const res = await fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', riderName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchRiders();
      showToast(`Shift reset for ${riderName.split(' (')[0]}`, 'border-blue-500');
    } catch (err) {
      showToast(err.message || 'Reset failed', 'border-red-500');
    } finally {
      setPendingRider(null);
    }
  };

  const handleResetAll = async () => {
    setLoadingRiders(true);
    try {
      const res = await fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resetAll' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchRiders();
      showToast('All rider shifts reset', 'border-blue-500');
    } catch (err) {
      showToast(err.message || 'Reset failed', 'border-red-500');
    } finally {
      setLoadingRiders(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Top Header Bar */}
      <header className="bg-slate-950/80 border-b border-slate-800/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          {/* Logo & App Name */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-md shadow-blue-500/20">
              ER
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white uppercase">
                  EcoRoute
                </span>
                <span className="text-xs text-slate-500 font-normal">|</span>
                <span className="text-xs font-medium text-slate-300">
                  Delhi NCR Dispatch Console
                </span>
              </div>
            </div>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-3">
            {compareMode && (
              <span className="text-[11px] font-semibold text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2.5 py-1 rounded-lg">
                Compare Mode
              </span>
            )}
            <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 live-beacon" />
              <span className="font-semibold text-emerald-300">Live</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Updated {lastUpdated || '—'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 right-6 z-[2000] max-w-sm transition-all duration-300">
          <div
            className={`bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-lg p-3.5 shadow-2xl flex items-center justify-between gap-3 text-xs border-l-4 ${toast.borderColor} text-slate-100`}
          >
            <span className="font-medium text-slate-200">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 flex-1 w-full">
        {initialLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4 xl:col-span-3">
              <div className="glass-panel rounded-lg p-5 h-96 flex flex-col gap-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-10 bg-slate-800 rounded" />
                <div className="h-10 bg-slate-800 rounded" />
                <div className="h-10 bg-slate-800 rounded" />
              </div>
            </div>
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4">
              <div className="h-[500px] bg-slate-900/80 border border-slate-800 rounded-lg animate-pulse" />
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-slate-900/80 border border-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-5 items-start">
            {/* Left Panel */}
            <div className="w-full lg:w-[320px] flex-none flex flex-col gap-4">
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
                onCalculate={handleCalculate}
                onSpikeTriggered={handleTriggerSpike}
                loading={loadingRoute}
                spikeLoading={loadingSpike}
                compareMode={compareMode}
                setCompareMode={handleCompareModeToggle}
                onCompare={handleCompare}
                loadingCompare={loadingCompare}
                riders={riders}
                selectedRiderId={selectedRiderId}
                setSelectedRiderId={handleRiderChange}
                maxDeliveryMinutes={maxDeliveryMinutes}
                setMaxDeliveryMinutes={handleMaxDeliveryMinutesChange}
                previewRoute={currentRoute}
                onCommitRoute={handleCommitRoute}
                loadingCommit={loadingCommit}
              />

              {/* Rider Exposure Budgets Panel */}
              <RiderPanel
                riders={riders}
                loading={loadingRiders}
                onResetRider={handleResetRider}
                onResetAll={handleResetAll}
                pendingRider={pendingRider}
              />
            </div>

            {/* Right Panel: Map + Metrics + High Risk */}
            <div className="flex-1 min-w-0 flex flex-col gap-4 w-full">
              {/* Map */}
              <MapView
                neighborhoods={neighborhoods}
                roads={roads}
                currentRoute={currentRoute}
                source={source}
                target={target}
                mode={mode}
                compareMode={compareMode}
                comparisonResult={comparisonResult}
              />

              {/* Metrics */}
              <MetricsPanel
                currentRoute={currentRoute}
                neighborhoods={neighborhoods}
                mode={mode}
                loading={loadingRoute}
                compareMode={compareMode}
                comparisonResult={comparisonResult}
                loadingCompare={loadingCompare}
              />

              {/* High-Risk Zones */}
              <HighRiskPanel
                highRiskNodes={highRiskNodes}
                loading={loadingSpike}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
