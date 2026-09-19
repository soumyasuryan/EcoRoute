'use client';

import { useEffect, useState, useMemo, useCallback, useSyncExternalStore } from 'react';
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

// In-memory cache for fetched road geometries
const roadGeometryCache = new Map();

// Idiomatic client hydration detector for React 19
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

// Helper to auto-fit map view to all route bounds
function RouteBounds({ routeCoords }) {
  const map = useMap();
  useEffect(() => {
    if (routeCoords && routeCoords.length > 1) {
      try {
        map.fitBounds(routeCoords, { padding: [50, 50], maxZoom: 13 });
      } catch (e) {
        // Map instance not ready
      }
    }
  }, [routeCoords, map]);
  return null;
}

// Fit map to encompass multiple route sets
function MultiRouteBounds({ allCoords }) {
  const map = useMap();
  useEffect(() => {
    const flat = allCoords.filter(Boolean).flat();
    if (flat.length > 1) {
      try {
        map.fitBounds(flat, { padding: [50, 50], maxZoom: 13 });
      } catch (e) {
        // Map instance not ready
      }
    }
  }, [allCoords, map]);
  return null;
}

// Compare mode polyline colors & styles
const COMPARE_STYLES = {
  fastest: { color: '#ef4444', weight: 4.5, dashArray: null, label: 'Fastest' },
  ecoSafe: { color: '#10b981', weight: 4.5, dashArray: null, label: 'Eco-Safe' },
  riskWeighted: { color: '#8b5cf6', weight: 4.5, dashArray: '6 4', label: 'Risk-Calibrated' }
};

export default function MapView({
  neighborhoods = [],
  roads = [],
  currentRoute = null,
  source = '',
  target = '',
  mode = 'fastest',
  // Compare mode
  compareMode = false,
  comparisonResult = null
}) {
  const isClient = useIsClient();
  const delhiCenter = [28.6139, 77.2090];

  // Coordinate lookup
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

  // Single route geometry state
  const [singleRoadCoords, setSingleRoadCoords] = useState([]);

  // Compare mode geometries state
  const [compareRoadGeometries, setCompareRoadGeometries] = useState({
    fastest: null,
    ecoSafe: null,
    riskWeighted: null
  });

  // Helper to fetch and stitch real road geometries for a graph path
  const fetchPathRoadGeometry = useCallback(
    async (pathNodes) => {
      if (!pathNodes || pathNodes.length < 2) return [];

      const coords = pathNodes.map((name) => coordMap.get(name)).filter(Boolean);
      if (coords.length < 2) return coords;

      const fullRoadPoints = [];

      for (let i = 0; i < coords.length - 1; i++) {
        const c1 = coords[i];
        const c2 = coords[i + 1];
        const legKey = `leg-${c1[0].toFixed(4)},${c1[1].toFixed(4)}->${c2[0].toFixed(4)},${c2[1].toFixed(4)}`;

        if (roadGeometryCache.has(legKey)) {
          const cachedLeg = roadGeometryCache.get(legKey);
          if (i === 0) {
            fullRoadPoints.push(...cachedLeg);
          } else {
            fullRoadPoints.push(...cachedLeg.slice(1));
          }
          continue;
        }

        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${c1[1]},${c1[0]};${c2[1]},${c2[0]}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();

          if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
            const legCoords = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            roadGeometryCache.set(legKey, legCoords);
            if (i === 0) {
              fullRoadPoints.push(...legCoords);
            } else {
              fullRoadPoints.push(...legCoords.slice(1));
            }
          } else {
            const fallbackLeg = [c1, c2];
            roadGeometryCache.set(legKey, fallbackLeg);
            if (i === 0) {
              fullRoadPoints.push(...fallbackLeg);
            } else {
              fullRoadPoints.push(...fallbackLeg.slice(1));
            }
          }
        } catch {
          const fallbackLeg = [c1, c2];
          if (i === 0) {
            fullRoadPoints.push(...fallbackLeg);
          } else {
            fullRoadPoints.push(...fallbackLeg.slice(1));
          }
        }
      }

      return fullRoadPoints;
    },
    [coordMap]
  );

  // 1. Single-Route Mode: fetch road geometry along graph computed path
  useEffect(() => {
    if (compareMode || !currentRoute?.path || currentRoute.path.length < 2) {
      setSingleRoadCoords([]);
      return;
    }

    let isCancelled = false;
    const pathKey = `single-path-${currentRoute.path.join('->')}`;

    if (roadGeometryCache.has(pathKey)) {
      setSingleRoadCoords(roadGeometryCache.get(pathKey));
      return;
    }

    fetchPathRoadGeometry(currentRoute.path).then((pts) => {
      if (!isCancelled && pts && pts.length > 0) {
        roadGeometryCache.set(pathKey, pts);
        setSingleRoadCoords(pts);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [compareMode, currentRoute?.path, fetchPathRoadGeometry]);

  // 2. Compare Mode: fetch road geometry for each of the 3 distinct graph paths
  useEffect(() => {
    if (!compareMode || !comparisonResult) {
      setCompareRoadGeometries({ fastest: null, ecoSafe: null, riskWeighted: null });
      return;
    }

    let isCancelled = false;
    const modes = [
      { key: 'fastest', data: comparisonResult.fastest },
      { key: 'ecoSafe', data: comparisonResult.ecoSafe },
      { key: 'riskWeighted', data: comparisonResult.riskWeighted }
    ];

    modes.forEach(({ key, data }) => {
      if (!data?.path || data.path.length < 2) {
        if (!isCancelled) {
          setCompareRoadGeometries((prev) => ({ ...prev, [key]: null }));
        }
        return;
      }

      const pathKey = `compare-path-${key}-${data.path.join('->')}`;

      if (roadGeometryCache.has(pathKey)) {
        if (!isCancelled) {
          setCompareRoadGeometries((prev) => ({
            ...prev,
            [key]: roadGeometryCache.get(pathKey)
          }));
        }
        return;
      }

      fetchPathRoadGeometry(data.path).then((pts) => {
        if (!isCancelled && pts && pts.length > 0) {
          roadGeometryCache.set(pathKey, pts);
          setCompareRoadGeometries((prev) => ({
            ...prev,
            [key]: pts
          }));
        }
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [compareMode, comparisonResult, fetchPathRoadGeometry]);

  // Active single-route geometry
  const activeGeometry = useMemo(() => {
    if (singleRoadCoords.length > 0) return singleRoadCoords;
    if (currentRoute?.path && currentRoute.path.length > 1) {
      return currentRoute.path.map((name) => coordMap.get(name)).filter(Boolean);
    }
    return [];
  }, [singleRoadCoords, currentRoute?.path, coordMap]);

  // Compare mode active geometries
  const activeCompareGeometries = useMemo(() => {
    if (!compareMode || !comparisonResult) return {};
    const fallbackPathCoords = (path) =>
      path && path.length > 1 ? path.map((name) => coordMap.get(name)).filter(Boolean) : null;

    return {
      fastest: compareRoadGeometries.fastest || fallbackPathCoords(comparisonResult.fastest?.path),
      ecoSafe: compareRoadGeometries.ecoSafe || fallbackPathCoords(comparisonResult.ecoSafe?.path),
      riskWeighted: compareRoadGeometries.riskWeighted || fallbackPathCoords(comparisonResult.riskWeighted?.path)
    };
  }, [compareMode, comparisonResult, compareRoadGeometries, coordMap]);

  const allCompareCoords = useMemo(() => {
    return Object.values(activeCompareGeometries).filter(Boolean).flat();
  }, [activeCompareGeometries]);

  // Which nodes are on any compare route
  const compareRouteNodes = useMemo(() => {
    if (!compareMode || !comparisonResult) return new Set();
    const s = new Set();
    ['fastest', 'ecoSafe', 'riskWeighted'].forEach((k) => {
      const data = comparisonResult[k];
      data?.path?.forEach((n) => s.add(n));
    });
    return s;
  }, [compareMode, comparisonResult]);

  // AQI color palette
  const getAqiColor = (aqi) => {
    if (aqi < 200) return '#10b981';
    if (aqi <= 400) return '#f59e0b';
    return '#ef4444';
  };

  const getAqiInfo = (aqi) => {
    if (aqi < 200) return { label: 'Normal (<200)', color: '#10b981' };
    if (aqi <= 400) return { label: 'Elevated (200-400)', color: '#f59e0b' };
    return { label: 'Severe (>400)', color: '#ef4444' };
  };

  if (!isClient) {
    return (
      <div className="w-full h-full min-h-[500px] bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs font-mono">
        Loading Delhi NCR Spatial Network...
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border border-slate-700/80 shadow-xl bg-slate-100">
      <MapContainer
        center={delhiCenter}
        zoom={11}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ height: '100%', width: '100%', background: '#ffffff' }}
      >
        {/* Bright, high-clarity OpenStreetMap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Faint network road connections */}
        {roads.map((road, idx) => {
          const c1 = coordMap.get(road.source);
          const c2 = coordMap.get(road.target);
          if (!c1 || !c2) return null;
          return (
            <Polyline
              key={`road-${road.source}-${road.target}-${idx}`}
              positions={[c1, c2]}
              pathOptions={{
                color: '#64748b',
                weight: 1.2,
                opacity: 0.3,
                dashArray: '3, 5'
              }}
            />
          );
        })}

        {/* === COMPARE MODE: 3 polylines === */}
        {compareMode && (
          <>
            {Object.entries(activeCompareGeometries).map(([key, coords]) => {
              if (!coords || coords.length < 2) return null;
              const style = COMPARE_STYLES[key] || { color: '#3b82f6', weight: 4 };
              return (
                <Polyline
                  key={`compare-${key}`}
                  positions={coords}
                  pathOptions={{
                    color: style.color,
                    weight: style.weight || (key === 'fastest' ? 3.5 : 4.5),
                    opacity: 0.9,
                    dashArray: style.dashArray
                  }}
                />
              );
            })}
            {allCompareCoords.length > 1 && (
              <MultiRouteBounds allCoords={[allCompareCoords]} />
            )}
          </>
        )}

        {/* === SINGLE ROUTE MODE === */}
        {!compareMode && currentRoute?.path && activeGeometry.length > 1 && (
          <>
            <Polyline
              key={`route-glow-${sourceName}-${targetName}-${mode}`}
              positions={activeGeometry}
              pathOptions={{
                color: '#3b82f6',
                weight: 8,
                opacity: 0.35
              }}
            />
            <Polyline
              key={`route-active-${sourceName}-${targetName}-${mode}`}
              positions={activeGeometry}
              pathOptions={{
                color: '#2563eb',
                weight: 4.5,
                opacity: 0.95
              }}
            />
            <RouteBounds routeCoords={activeGeometry} />
          </>
        )}

        {/* Neighborhood / Warehouse Markers */}
        {neighborhoods.map((node) => {
          const color = getAqiColor(node.aqi);
          const { label } = getAqiInfo(node.aqi);
          const isWarehouse = node.isWarehouse;
          const isSelectedSource = sourceName === node.name;
          const isSelectedTarget = targetName === node.name;
          const isOnRoute = compareMode
            ? compareRouteNodes.has(node.name)
            : currentRoute?.path?.includes(node.name);
          const isHazardous = node.aqi > 400;

          const radius = isWarehouse ? 9.5 : isSelectedSource || isSelectedTarget ? 8.5 : 7;

          return (
            <div key={node.name}>
              {/* Pulsing ring for hazardous stations */}
              {isHazardous && (
                <CircleMarker
                  center={[node.lat, node.lon]}
                  radius={radius + 6}
                  pathOptions={{
                    color: '#ef4444',
                    weight: 1.2,
                    opacity: 0.6,
                    fillColor: '#ef4444',
                    fillOpacity: 0.08,
                    dashArray: '2, 4'
                  }}
                />
              )}

              <CircleMarker
                center={[node.lat, node.lon]}
                radius={radius}
                pathOptions={{
                  color: isWarehouse ? '#1e293b' : '#ffffff',
                  weight: isWarehouse ? 2.5 : 1.8,
                  fillColor: color,
                  fillOpacity: 0.95
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <div className="text-xs text-slate-900 font-semibold">
                    {node.name} {isWarehouse && '🏭 (Warehouse)'}
                    <span className="block text-[11px] font-normal text-slate-600">
                      AQI: <strong>{node.aqi}</strong> — {label}
                    </span>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="text-slate-100 text-xs min-w-[180px] space-y-1.5 p-1">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/80">
                      <span className="font-bold text-sm text-white">{node.name}</span>
                      {isWarehouse && (
                        <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          Warehouse
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-slate-400 font-medium">AQI Index:</span>
                      <span className="font-mono font-bold text-white text-sm">{node.aqi}</span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-slate-400 font-medium">Severity Band:</span>
                      <span className="font-semibold text-[11px] flex items-center gap-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span>{label}</span>
                      </span>
                    </div>

                    {isSelectedSource && (
                      <div className="text-[11px] font-semibold text-blue-400 pt-1 border-t border-slate-700/60">
                        ● Selected Warehouse Origin
                      </div>
                    )}
                    {isSelectedTarget && (
                      <div className="text-[11px] font-semibold text-emerald-400 pt-1 border-t border-slate-700/60">
                        ● Selected Customer Drop-off
                      </div>
                    )}
                    {isOnRoute && !isSelectedSource && !isSelectedTarget && (
                      <div className="text-[11px] font-medium text-slate-300 pt-1 border-t border-slate-700/60">
                        ➔ Route Checkpoint
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            </div>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] glass-panel px-3.5 py-2.5 rounded-lg border border-slate-700/80 shadow-2xl text-xs text-slate-200">
        <div className="font-semibold text-white text-xs pb-1.5 mb-1.5 border-b border-slate-700/60 flex items-center justify-between gap-3">
          <span>AQI Severity Bands</span>
          <span className="text-[10px] font-mono text-slate-400">{neighborhoods.length} Stations</span>
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-sm" />
            <span className="text-slate-200">Normal (&lt;200)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-sm" />
            <span className="text-slate-200">Elevated (200-400)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-sm" />
            <span className="text-slate-200">Severe (&gt;400)</span>
          </div>
          <div className="pt-1.5 mt-1.5 border-t border-slate-700/60 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 bg-slate-800" />
            <span className="text-blue-300 font-medium">Warehouse Hub</span>
          </div>
        </div>

        {/* Compare mode route legend */}
        {compareMode && comparisonResult && (
          <div className="pt-1.5 mt-1.5 border-t border-slate-700/60 space-y-1">
            {Object.entries(COMPARE_STYLES).map(([key, style]) => (
              <div key={key} className="flex items-center gap-2">
                <svg width="16" height="8" className="shrink-0">
                  <line
                    x1="0" y1="4" x2="16" y2="4"
                    stroke={style.color}
                    strokeWidth="2"
                    strokeDasharray={style.dashArray || ''}
                  />
                </svg>
                <span className="text-slate-300">{style.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
