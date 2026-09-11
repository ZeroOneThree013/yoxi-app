import type { Coord, PlannedRoute, PlannedStop } from '../types';
import { MOCK_GPS } from '../data/mock';

/** 兩點間直線距離（公里），Haversine */
export function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface RawStop {
  placeId: string;
  name: string;
  meta: string;
  lat: number;
  lng: number;
}

/**
 * 取地點座標給「路線地圖 / 距離計算」用。
 *
 * ⚠️ 已知下一步工作：Places sheet 已經有 lat / lng 欄位，但目前實際值都是空的
 *   （還沒有座標來源）。所以這裡在沒有真實座標時，暫時沿用原型的假座標
 *   ——依 id 把地點打散在「目前位置」附近。之後接「截圖辨識取得座標」或
 *   「依地區文字做 geocoding」再改成用真實值，屆時就會走上面那個 return。
 */
export function placeCoord(place: {
  id: string;
  lat?: number | null;
  lng?: number | null;
}): Coord {
  if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    return { lat: place.lat, lng: place.lng };
  }
  const seed = place.id
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return {
    lat: MOCK_GPS.lat + ((seed % 40) - 20) / 1000,
    lng: MOCK_GPS.lng + (((seed * 7) % 40) - 20) / 1000,
  };
}

/**
 * mock 版 AI 路線規劃：從 `origin`（使用者目前位置，可能是真實 GPS 或 fallback）
 * 出發，用最近鄰法排出造訪順序。
 * spec 第 4 節：正式版換成真實 TSP 最佳化 / 距離矩陣。
 */
export function planRoute(picked: RawStop[], origin: Coord): PlannedRoute {
  const remaining = [...picked];
  const ordered: PlannedStop[] = [];
  let cursor: Coord = { lat: origin.lat, lng: origin.lng };
  let totalDist = 0;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineKm(cursor, s);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    totalDist += bestDist;
    ordered.push({ ...next, dist: Math.round(bestDist * 10) / 10 });
    cursor = { lat: next.lat, lng: next.lng };
  }

  const totalTime = Math.max(6, Math.round(totalDist * 2.6 + ordered.length * 3));
  const totalCost = Math.round(60 + totalDist * 13);

  return {
    stops: ordered,
    totalDist: Math.round(totalDist * 10) / 10,
    totalTime,
    totalCost,
    origin: { lat: origin.lat, lng: origin.lng },
  };
}

/** 單純叫車的粗估（spec 2.7），mock 版依目的地字串長度做視覺化估算 */
export function estimateQuickRide(dest: string) {
  const km = Math.round((2 + (dest.length % 6) * 1.3) * 10) / 10;
  const min = Math.round(km * 2.8 + 4);
  const cost = Math.round(60 + km * 13);
  return { km, min, cost };
}

/**
 * 向 OSRM 公開 demo server 要一段貼合道路的路徑（GeoJSON 座標）。
 * 失敗 / 逾時回傳 null，呼叫端 fallback 成直線（對照原型 drawRouteSegment）。
 * spec 第 4 節：正式版換成有 SLA 的路徑規劃服務。
 */
export async function fetchRoadPath(
  from: Coord,
  to: Coord,
): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const coords: [number, number][] | undefined =
      data?.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    return coords.map(([lng, lat]) => [lat, lng]);
  } catch {
    return null;
  }
}
