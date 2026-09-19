'use client';

import { useEffect, useState } from 'react';
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
        // ignore if not ready
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
  // Map Delhi NCR center coordinates
  const delhiCenter = [28.6139, 77.209];

  // Lookup map for coords by name
  const coordMap = new Map();
  neighborhoods.forEach((n) => {
    coordMap.set(n.name, [n.lat, n.lon]);
  });

  // Convert currentRoute path array ['Dwarka', 'Janakpuri', ...] to [[lat, lon], ...]
  const routeCoords = (currentRoute?.path || [])
    .map((name) => coordMap.get(name))
    .filter(Boolean);

  // State to hold high-resolution, turn-by-turn road geometry following actual streets
  const [roadGeometry, setRoadGeometry] = useState([]);
  const [isLoadingRoads, setIsLoadingRoads] = useState(false);

  // Query OSRM OpenStreetMap routing service for actual street-level geometry
  useEffect(() => {
    if (!currentRoute?.path || currentRoute.path.length < 2) {
      setRoadGeometry([]);
      return;
    }

    const pathKey = currentRoute.path.join('->');
    if (roadGeometryCache.has(pathKey)) {
      setRoadGeometry(roadGeometryCache.get(pathKey));
      return;
    }

    // Immediately display waypoint centroids as fallback
    const directCoords = currentRoute.path.map((name) => coordMap.get(name)).filter(Boolean);
    setRoadGeometry(directCoords);
    setIsLoadingRoads(true);

    // OSRM expects coordinates in "lon,lat" format separated by ";"
    const osrmCoords = directCoords.map(([lat, lon]) => `${lon},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;

    let isCancelled = false;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!isCancelled && data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
          // Convert GeoJSON [lon, lat] back to Leaflet [lat, lon]
          const realRoadCoords = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          roadGeometryCache.set(pathKey, realRoadCoords);
          setRoadGeometry(realRoadCoords);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch OSRM road geometry, using fallback coordinates:', err.message);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingRoads(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentRoute?.path]);

  // Helper to determine AQI color status
  const getAqiColor = (aqi) => {
    if (aqi < 200) return '#10b981'; // Green: Good / Moderate
    if (aqi <= 400) return '#f59e0b'; // Yellow/Amber: Poor / Very Poor
    return '#ef4444'; // Red: Severe / Hazardous (> 400)
  };

  const getAqiCategory = (aqi) => {
    if (aqi < 200) return { label: 'Moderate', badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (aqi <= 400) return { label: 'Very Poor', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    return { label: 'Hazardous', badgeClass: 'bg-red-500/20 text-red-400 border-red-500/30' };
  };

  // Route color styling by mode
  const getRouteColor = () => {
    if (mode === 'eco-safe') return '#10b981'; // Emerald
    if (mode === 'risk-weighted') return '#8b5cf6'; // Purple
    return '#0284c7'; // Blue for Fastest
  };

  // Clean up Leaflet DOM container state during HMR/re-renders
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        const container = document.getElementById('ecoroute-map-container');
        if (container) {
          container._leaflet_id = null;
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 bg-slate-950">
      <MapContainer
        id="ecoroute-map-container"
        center={delhiCenter}
        zoom={11}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ height: '100%', minHeight: '520px', width: '100%', background: '#0f172a' }}
      >
        {/* Standard OpenStreetMap Tiles (No API key needed) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                color: '#64748b',
                weight: 1.5,
                opacity: 0.35,
                dashArray: '3, 6'
              }}
            />
          );
        })}

        {/* Highlighted Active Route Polyline following real road network */}
        {routeCoords.length > 1 && (
          <>
            {/* Route glow outline */}
            <Polyline
              key={`route-glow-${(currentRoute?.path || []).join('-')}-${mode}-${currentRoute?.totalDistance}-${roadGeometry.length}`}
              positions={roadGeometry.length > 0 ? roadGeometry : routeCoords}
              pathOptions={{
                color: getRouteColor(),
                weight: 8,
                opacity: 0.45
              }}
            />
            {/* Sharp core polyline following real street curves and highways */}
            <Polyline
              key={`route-core-${(currentRoute?.path || []).join('-')}-${mode}-${currentRoute?.totalDistance}-${roadGeometry.length}`}
              positions={roadGeometry.length > 0 ? roadGeometry : routeCoords}
              pathOptions={{
                color: getRouteColor(),
                weight: 4.5,
                opacity: 0.95
              }}
            />
            <RouteBounds routeCoords={roadGeometry.length > 0 ? roadGeometry : routeCoords} />
          </>
        )}

        {/* Neighborhood Markers */}
        {neighborhoods.map((node) => {
          const color = getAqiColor(node.aqi);
          const { label, badgeClass } = getAqiCategory(node.aqi);
          const isSelectedSource = source === node.name;
          const isSelectedTarget = target === node.name;
          const isOnRoute = currentRoute?.path?.includes(node.name);

          // Warehouses get larger radius, high contrast purple/slate border
          const isWarehouse = node.isWarehouse;
          const radius = isWarehouse ? 13 : isSelectedSource || isSelectedTarget ? 11 : 9;

          return (
            <CircleMarker
              key={node.name}
              center={[node.lat, node.lon]}
              radius={radius}
              pathOptions={{
                color: isWarehouse
                  ? '#3b82f6'
                  : isSelectedSource
                  ? '#3b82f6'
                  : isSelectedTarget
                  ? '#ec4899'
                  : isOnRoute
                  ? '#ffffff'
                  : '#1e293b',
                weight: isWarehouse ? 4 : isSelectedSource || isSelectedTarget ? 3 : 2,
                fillColor: color,
                fillOpacity: isWarehouse ? 0.95 : 0.85,
                dashArray: isWarehouse ? '2, 3' : undefined
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <div className="font-semibold text-xs text-slate-800">
                  {node.name} {isWarehouse && '🏭 [Warehouse]'}
                  <span className="block text-[11px] font-normal text-slate-600">
                    AQI: <strong style={{ color }}>{node.aqi}</strong>
                  </span>
                </div>
              </Tooltip>

              <Popup>
                <div className="p-1 max-w-[200px] text-slate-900">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-sm tracking-tight m-0">
                      {node.name}
                    </h4>
                    {isWarehouse && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wider">
                        Warehouse
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-600">AQI Index:</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded border ${badgeClass}`}
                    >
                      {node.aqi} • {label}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    Coords: {node.lat.toFixed(4)}, {node.lon.toFixed(4)}
                  </div>
                  {isSelectedSource && (
                    <div className="mt-2 text-[11px] font-medium text-blue-600">
                      📍 Selected as Route Origin
                    </div>
                  )}
                  {isSelectedTarget && (
                    <div className="mt-2 text-[11px] font-medium text-pink-600">
                      🎯 Selected as Destination
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Top Right Street Navigation Badge */}
      <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-lg text-[11px] text-slate-200 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-semibold text-slate-300">
          {isLoadingRoads ? '🛣️ Tracing Delhi NCR Roads...' : '🛣️ Street-Level Road Network'}
        </span>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-700/60 shadow-lg text-xs text-slate-200">
        <div className="font-semibold text-[11px] tracking-wider uppercase text-slate-400 mb-2">
          Air Quality Legend
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
            <span>&lt; 200 Good / Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-sm"></span>
            <span>200 - 400 Poor / Severe</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-sm"></span>
            <span>&gt; 400 Hazardous (Red Zone)</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-blue-400 bg-slate-700 inline-block"></span>
            <span className="font-medium text-blue-300">🏭 Fulfillment Warehouse</span>
          </div>
        </div>
      </div>
    </div>
  );
}
