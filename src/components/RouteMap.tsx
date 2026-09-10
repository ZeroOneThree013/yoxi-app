import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { MOCK_GPS } from '../data/mock';
import { fetchRoadPath } from '../lib/route';
import type { PlannedStop } from '../types';

const RED = '#FF210C';

function pin(kind: 'user' | 'stop', label: string) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin map-pin-${kind}"><span>${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

/** 依序對相鄰站點請求 OSRM 真實道路路徑，失敗 fallback 直線（對照原型） */
function RoadPaths({ points }: { points: [number, number][] }) {
  const [paths, setPaths] = useState<[number, number][][]>([]);
  const [fallbacks, setFallbacks] = useState<[number, number][][]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const road: [number, number][][] = [];
      const straight: [number, number][][] = [];
      for (let i = 0; i < points.length - 1; i++) {
        const from = { lat: points[i][0], lng: points[i][1] };
        const to = { lat: points[i + 1][0], lng: points[i + 1][1] };
        const seg = await fetchRoadPath(from, to);
        if (cancelled) return;
        if (seg) road.push(seg);
        else straight.push([points[i], points[i + 1]]);
      }
      if (!cancelled) {
        setPaths(road);
        setFallbacks(straight);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  return (
    <>
      {paths.map((p, i) => (
        <Polyline key={`r${i}`} positions={p} pathOptions={{ color: RED, weight: 4, opacity: 0.85 }} />
      ))}
      {fallbacks.map((p, i) => (
        <Polyline
          key={`f${i}`}
          positions={p}
          pathOptions={{ color: RED, weight: 3, opacity: 0.7, dashArray: '6,6' }}
        />
      ))}
    </>
  );
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) {
      map.fitBounds(points, { padding: [36, 36] });
    }
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map, points]);
  return null;
}

export default function RouteMap({ stops }: { stops: PlannedStop[] }) {
  const user: [number, number] = [MOCK_GPS.lat, MOCK_GPS.lng];
  const stopPts = stops
    .filter((s) => !Number.isNaN(s.lat) && !Number.isNaN(s.lng))
    .map((s) => [s.lat, s.lng] as [number, number]);
  const points = [user, ...stopPts];

  return (
    <div className="mb-4 h-[260px] overflow-hidden rounded-[18px] bg-paper-deep">
      <MapContainer
        center={user}
        zoom={13}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={19}
        />
        <Marker position={user} icon={pin('user', '你')}>
          <Popup>你的目前位置</Popup>
        </Marker>
        {stops.map((s, i) => (
          <Marker
            key={s.placeId}
            position={[s.lat, s.lng]}
            icon={pin('stop', String(i + 1))}
          >
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {s.meta}
            </Popup>
          </Marker>
        ))}
        <RoadPaths points={points} />
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
