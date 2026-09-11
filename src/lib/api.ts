import { API_BASE_URL, DEMO_USER_ID } from '../config';
import { MOCK_PLACES } from '../data/mock';
import type { Place } from '../types';

/**
 * API 層：把對 Google Apps Script 的 fetch 呼叫包起來。
 * 之後要抽換 base URL 只改 src/config.ts。
 *
 * CORS：POST 用 Content-Type: text/plain 送 JSON 字串，避開瀏覽器 preflight
 * （spec 6.2「CORS 注意事項」）。GAS 端自己 JSON.parse(e.postData.contents)。
 */

/** Places sheet 的一列（GAS 後端回傳格式） */
export interface PlaceRecord {
  id: string;
  userId: string;
  storeName: string;
  region: string;
  category: string;
  source: string;
  imageUrl: string;
  /** 預留欄位，目前後端一律回 null（還沒有座標來源） */
  lat: number | null;
  lng: number | null;
  createdAt: string;
  visited: boolean;
}

/** 新增收藏地點時前端要送的欄位 */
export interface NewPlaceInput {
  storeName: string;
  region: string;
  category: string;
  source: string;
  /** 截圖 base64；base64 圖片之後接 VLM／圖床再一起處理，目前多半留空 */
  imageUrl?: string;
}

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isConfigured = () => API_BASE_URL.length > 0;

/**
 * 後端 record → 前端 Place。
 * lat / lng 直接帶後端的值（目前一律 null）。路線地圖需要座標時，
 * 由 lib/route.ts 的 placeCoord() 在沒有實值時回傳假座標（已知下一步工作）。
 */
function toPlace(r: PlaceRecord): Place {
  return {
    id: String(r.id),
    name: r.storeName || '未命名地點',
    region: r.region || '',
    category: r.category || '未分類',
    source: r.source || '截圖上傳',
    lat: typeof r.lat === 'number' ? r.lat : null,
    lng: typeof r.lng === 'number' ? r.lng : null,
    visited: r.visited === true,
    imageDataUrl: r.imageUrl || undefined,
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      '後端回傳的不是合法 JSON（多半是 Web App 網址、存取權限或部署版本的問題，見 gas/README.md）',
    );
  }
}

async function request(url: string, init?: RequestInit, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
  } catch {
    throw new Error(
      ctrl.signal.aborted
        ? '連線逾時，請稍後再試'
        : '連線失敗，請檢查網路或後端網址',
    );
  } finally {
    clearTimeout(timer);
  }
}

// ── 未設定 API_BASE_URL 時的本機暫存：貼上部署網址前，畫面仍可正常操作（重整會重置）
let mockStore: Place[] | null = null;
const getMockStore = () => (mockStore ??= [...MOCK_PLACES]);

/** 依 userId 取回收藏地點清單（對應「想去的地方」清單畫面） */
export async function fetchPlaces(userId = DEMO_USER_ID): Promise<Place[]> {
  if (!isConfigured()) {
    console.warn(
      '[api] 尚未設定 API_BASE_URL（src/config.ts），使用本機 mock 收藏地點',
    );
    return [...getMockStore()];
  }
  const res = await request(
    `${API_BASE_URL}?userId=${encodeURIComponent(userId)}`,
  );
  const json = await parseJson<ApiResponse<PlaceRecord[]>>(res);
  if (!json.success) throw new Error(json.message || '讀取收藏地點失敗');
  return json.data.map(toPlace);
}

/** 新增一筆收藏地點（對應「上傳截圖 → 儲存到想去的地方」） */
export async function createPlace(
  input: NewPlaceInput,
  userId = DEMO_USER_ID,
): Promise<Place> {
  if (!isConfigured()) {
    console.warn(
      '[api] 尚未設定 API_BASE_URL（src/config.ts），改用本機模擬新增',
    );
    const local = toPlace({
      id: `local_${Date.now()}`,
      userId,
      storeName: input.storeName,
      region: input.region,
      category: input.category,
      source: input.source,
      imageUrl: input.imageUrl ?? '',
      lat: null,
      lng: null,
      createdAt: new Date().toISOString(),
      visited: false,
    });
    getMockStore().unshift(local);
    return local;
  }

  const res = await request(
    API_BASE_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ userId, ...input }),
    },
    15000,
  );
  const json = await parseJson<ApiResponse<PlaceRecord>>(res);
  if (!json.success) throw new Error(json.message || '新增收藏地點失敗');
  return toPlace(json.data);
}
