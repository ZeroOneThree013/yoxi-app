import { fetchNearbyPois } from './api';
import { haversineKm } from './route';
import type { Coord, RecommendedPlace } from '../types';

/**
 * 「依偏好推薦」分頁的推薦邏輯（spec 2.5，簡單版）：
 *   1. 從使用者已收藏的地點統計出現最多次的 category 當偏好類別
 *   2. 用真實 GPS + 偏好類別查 Overpass API 拿附近真實存在的地點
 *   3. 用 lib/route.ts 既有的 haversineKm 算真實距離、排序、取前幾筆
 *
 * 十秒問答的方向偏好這次不處理（問答結果目前不持久化，是另一個獨立項目）。
 */

export const DEFAULT_PREFERRED_CATEGORY = '咖啡廳';

/**
 * 統計收藏地點裡最常見的 category。
 * 收藏是空的、或每個類別都只出現一次（看不出明顯偏好）就回預設類別，
 * 呼叫端可以用 isFallback 決定要不要顯示「還沒收藏足夠資料」之類的提示。
 */
export function pickPreferredCategory(
  places: { category: string }[],
): { category: string; isFallback: boolean } {
  const counts = new Map<string, number>();
  for (const p of places) {
    const c = p.category?.trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [c, n] of counts) {
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }

  // bestCount <= 1 代表清單是空的、或每個類別都只出現一次，看不出明顯偏好
  if (!best || bestCount <= 1) {
    return { category: DEFAULT_PREFERRED_CATEGORY, isFallback: true };
  }
  return { category: best, isFallback: false };
}

/**
 * 依偏好類別查附近真實地點，回傳依真實距離排序、取前 limit 筆的推薦清單。
 * Overpass 查詢失敗或查無結果都直接把錯誤丟出去 / 回傳空陣列，
 * 呼叫端（TaskSelect）要顯示乾淨的失敗或空狀態，不能 fallback 回假地點。
 */
export async function fetchNearbyRecommendations(
  origin: Coord,
  category: string,
  limit = 5,
): Promise<RecommendedPlace[]> {
  const pois = await fetchNearbyPois(origin, category);

  return pois
    .map((poi) => ({ poi, dist: haversineKm(origin, poi) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map(({ poi }) => ({
      id: poi.id,
      name: poi.name,
      region: poi.address,
      category,
      source: 'yoxi 推薦',
      reason: `${category}偏好`,
      lat: poi.lat,
      lng: poi.lng,
      visited: false,
    }));
}
