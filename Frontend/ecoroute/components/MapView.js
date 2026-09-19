'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  Tooltip,
  useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// In-memory cache for fetched road geometries to eliminate re-fetching
const roadGeometryCache = new Map();

// Helper component to auto-pan or fit bounds if route changes
function RouteBounds({ routeCoords }) {
  const map = useMap();
  useEffect(() => {
    if (routeCoords && routeCoords.length > 1) {
      try {
        map.fitBounds(routeCoords, { padding: [50, 50], maxZoom: 13 });
      } catch (e) {
        // ignore if map instance not ready
      }
    }
  }, [routeCoords, map]);
  return null;
}

export default function MapView({
  neighborhoods = [],
  roads = [],
  currentRoute = null,
  source = '',
  target = '',
  mode = 'fastest'
}) {
  // Delhi NCR geographical center coordinates
  const delhiCenter = [28.6139, 77.2090];

  // Lookup map for coords by name
  const coordMap = useMemo(() => {
    const map = new Map();
    neighborhoods.forEach((n) => {
      map.set(n.name, [n.lat, n.lon]);
    });
    return map;
  }, [neighborhoods]);

  const sourceName = source || currentRoute?.path?.[0] || '';
  const targetName = target || currentRoute?.path?.[currentRoute?.path?.length - 1] || '';
  const sourceCoord = coordMap.get(sourceName);
  const targetCoord = coordMap.get(targetName);
  const routeCoords = useMemo(() => [sourceCoord, targetCoord].filter(Boolean), [sourceCoord, targetCoord]);

  // State to hold high-resolution, turn-by-turn road geometry following actual practical highway/arterial streets
  const [roadGeometry, setRoadGeometry] = useState([]);
  const [isLoadingRoads, setIsLoadingRoads] = useState(false);

  // Query OSRM OpenStreetMap routing service for the practical driving route directly from origin to destination
  useEffect(() => {
    if (!sourceCoord || !targetCoord || sourceName === targetName) {
      setRoadGeometry([]);
      return;
    }

    const cacheKey = `${sourceName}->${targetName}-${mode}-${currentRoute?.alpha || 1.0}`;
    if (roadGeometryCache.has(cacheKey)) {
      setRoadGeometry(roadGeometryCache.get(cacheKey));
      return;
    }

    // Direct origin-to-destination straight line as immediate fallback
    setRoadGeometry([sourceCoord, targetCoord]);
    setIsLoadingRoads(true);

    // Query OSRM for practical driving route directly from warehouse origin to customer destination
    const url = `https://router.project-osrm.org/route/v1/driving/${sourceCoord[1]},${sourceCoord[0]};${targetCoord[1]},${targetCoord[0]}?overview=full&geometries=geojson&alternatives=true`;

    let isCancelled = false;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          return;
        }

        const candidateRoutes = data.routes;
        let chosenRoute = candidateRoutes[0];

        // For Eco-Safe or Risk-Weighted, evaluate candidate highway routes against neighborhood AQI
        if (candidateRoutes.length > 1 && mode !== 'fastest') {
          const scoredRoutes = candidateRoutes.map((route, idx) => {
            const coords = route.geometry.coordinates; // [lon, lat]
            let totalAqi = 0;
            let maxAqi = 0;
            const step = Math.max(1, Math.floor(coords.length / 30));
            let samples = 0;

            for (let i = 0; i < coords.length; i += step) {
              const [lon, lat] = coords[i];
              let minDistSq = Infinity;
              let localAqi = 150;

              for (const n of neighborhoods) {
                const distSq = (n.lat - lat) ** 2 + (n.lon - lon) ** 2;
                if (distSq < minDistSq) {
                  minDistSq = distSq;
                  localAqi = n.aqi;
                }
              }

              totalAqi += localAqi;
              if (localAqi > maxAqi) maxAqi = localAqi;
              samples++;
            }

            const avgAqi = samples > 0 ? totalAqi / samples : 150;
            const distKm = route.distance / 1000;

            return {
              route,
              idx,
              avgAqi,
              maxAqi,
              distKm
            };
          });

          if (mode === 'eco-safe') {
            // Pick route with lowest peak/max AQI (avoiding severe smog hotspots), tie-break with lowest avg AQI
            scoredRoutes.sort((a, b) => {
              if (a.maxAqi !== b.maxAqi) return a.maxAqi - b.maxAqi;
              return a.avgAqi - b.avgAqi;
            });
            chosenRoute = scoredRoutes[0].route;
          } else if (mode === 'risk-weighted') {
            // Calibrate route using cost function: distance + (alpha * avgAQI / 100)
            const alphaVal = Number(currentRoute?.alpha) || 1.0;
            scoredRoutes.sort((a, b) => {
              const costA = a.distKm + (alphaVal * a.avgAqi) / 100;
              const costB = b.distKm + (alphaVal * b.avgAqi) / 100;
              return costA - costB;
            });
            chosenRoute = scoredRoutes[0].route;
          }
        }

        if (chosenRoute?.geometry?.coordinates) {
          // Convert GeoJSON [lon, lat] to Leaflet [lat, lon]
          const realRoadCoords = chosenRoute.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          roadGeometryCache.set(cacheKey, realRoadCoords);
          setRoadGeometry(realRoadCoords);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch practical OSRM road geometry, using fallback straight-line:', err.message);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingRoads(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [sourceName, targetName, mode, currentRoute?.alpha, neighborhoods, sourceCoord, targetCoord]);

  // Color mapping by AQI level
  const getAqiColor = (aqi) => {
    if (aqi < 200) return '#10b981'; // Green: Good / Moderate
    if (aqi <= 400) return '#f59e0b'; // Amber: Poor / Severe
    return '#f43f5e'; // Crimson Rose: Hazardous (> 400)
  };

  const getAqiCategory = (aqi) => {
    if (aqi < 200) return { label: 'Moderate', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (aqi <= 400) return { label: 'Severe', badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    return { label: 'Hazardous', badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  };

  // Route stroke color by mode
  const getRouteColor = () => {
    if (mode === 'eco-safe') return '#10b981'; // Emerald
    if (mode === 'risk-weighted') return '#a855f7'; // Purple
    return '#38bdf8'; // Sky Blue for Fastest
  };

  // Ensure clean client-side mount lifecycle without DOM element reuse collisions
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
    };
  }, []);

  if (!mounted) {
    return (
      <div className="relative w-full h-full min-h-[540px] rounded-2xl overflow-hidden glass-panel border-slate-800/80 bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-500">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-xs font-mono">Initializing Delhi NCR Canvas...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[540px] rounded-2xl overflow-hidden glass-panel border-slate-800/80 bg-slate-950">
      <MapContainer
        center={delhiCenter}
        zoom={11}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ height: '100%', minHeight: '540px', width: '100%', background: '#080c15' }}
      >
        {/* Clean Standard OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Faint network roads to visualize city connectivity */}
        {roads.map((road, idx) => {
          const c1 = coordMap.get(road.source);
          const c2 = coordMap.get(road.target);
          if (!c1 || !c2) return null;
          return (
            <Polyline
              key={`road-${road.source}-${road.target}-${idx}`}
              positions={[c1, c2]}
              pathOptions={{
                color: '#475569',
                weight: 1.2,
                opacity: 0.25,
                dashArray: '3, 6'
              }}
            />
          );
        })}

        {/* Highlighted Active Practical Route Polyline following real road network */}
        {roadGeometry.length > 1 && (
          <>
            {/* Route atmospheric glow stroke */}
            <Polyline
              key={`route-glow-${sourceName}-${targetName}-${mode}-${roadGeometry.length}`}
              positions={roadGeometry}
              pathOptions={{
                color: getRouteColor(),
                weight: 8,
                opacity: 0.4
              }}
            />
            {/* Sharp core polyline following actual highway avenues */}
            <Polyline
              key={`route-core-${sourceName}-${targetName}-${mode}-${roadGeometry.length}`}
              positions={roadGeometry}
              pathOptions={{
                color: getRouteColor(),
                weight: 4,
                opacity: 0.95
              }}
            />
            <RouteBounds routeCoords={roadGeometry} />
          </>
        )}

        {/* Station Markers (Warehouses & Customer Neighborhoods) */}
        {neighborhoods.map((node) => {
          const color = getAqiColor(node.aqi);
          const { label, badgeClass } = getAqiCategory(node.aqi);
          const isSelectedSource = sourceName === node.name;
          const isSelectedTarget = targetName === node.name;
          const isOnRoute = currentRoute?.path?.includes(node.name);
          const isWarehouse = node.isWarehouse;
          const isHazardous = node.aqi > 400;

          const radius = isWarehouse ? 11 : isSelectedSource || isSelectedTarget ? 10 : 7;

          return (
            <div key={node.name}>
              {/* Pulsing radar ring for severe hazardous nodes */}
              {isHazardous && (
                <CircleMarker
                  center={[node.lat, node.lon]}
                  radius={radius + 8}
                  pathOptions={{
                    color: '#f43f5e',
                    weight: 1.5,
                    opacity: 0.5,
                    fillColor: '#f43f5e',
                    fillOpacity: 0.1,
                    dashArray: '2, 4'
                  }}
                />
              )}

              <CircleMarker
                center={[node.lat, node.lon]}
                radius={radius}
                pathOptions={{
                  color: isWarehouse
                    ? '#60a5fa'
                    : isSelectedSource
                    ? '#38bdf8'
                    : isSelectedTarget
                    ? '#34d399'
                    : isOnRoute
                    ? '#ffffff'
                    : '#0f172a',
                  weight: isWarehouse ? 3.5 : isSelectedSource || isSelectedTarget ? 3 : isOnRoute ? 2.5 : 1.5,
                  fillColor: color,
                  fillOpacity: isWarehouse ? 0.95 : 0.85,
                  dashArray: isWarehouse ? '3, 3' : undefined
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <div className="font-sans text-xs text-slate-900 font-semibold">
                    {node.name} {isWarehouse && '🏭 [Warehouse]'}
                    <span className="block text-[10px] font-mono font-normal text-slate-600">
                      Zone: {node.zone || 'Delhi NCR'} • AQI: <strong style={{ color }}>{node.aqi}</strong>
                    </span>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="p-1 min-w-[180px] text-slate-100 font-sans">
                    <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-700/60">
                      <h4 className="font-semibold text-xs text-slate-100">
                        {node.name}
                      </h4>
                      {isWarehouse && (
                        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                          Warehouse
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-slate-400 text-[11px]">Air Quality:</span>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${badgeClass}`}>
                        {node.aqi} • {label}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 mt-2">
                      Zone: {node.zone || 'Delhi NCR'}
                    </div>

                    {isSelectedSource && (
                      <div className="mt-2 text-[10px] font-mono text-blue-400 flex items-center gap-1">
                        <span>●</span> Active Origin Hub
                      </div>
                    )}
                    {isSelectedTarget && (
                      <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <span>●</span> Active Customer Destination
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>

      {/* Floating Header Badge */}
      <div className="absolute top-4 right-4 z-[1000] glass-panel px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-200 flex items-center gap-2 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-medium text-slate-300">
          {isLoadingRoads ? 'Tracing Arterial Highways...' : 'Delhi NCR Highway Routing'}
        </span>
      </div>

      {/* Floating Minimal Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] glass-panel px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs text-slate-300 shadow-lg">
        <div className="font-mono text-[10px] tracking-wider uppercase text-slate-400 mb-2 flex items-center justify-between gap-4">
          <span>AQI Sensor Status</span>
          <span className="text-slate-500">{neighborhoods.length} Stations</span>
        </div>
        <div className="flex flex-col gap-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span>
            <span>&lt; 200 Moderate / Acceptable</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></span>
            <span>200 - 400 Severe Exposure</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></span>
            <span>&gt; 400 Hazardous (Red Exclusion Zone)</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-blue-400 bg-slate-700"></span>
            <span className="text-blue-300 font-medium">Fulfillment Warehouse Hub (5)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
