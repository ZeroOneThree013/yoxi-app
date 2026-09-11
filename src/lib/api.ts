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
  /**
   * 截圖辨識（Gemini）順便估算的大概座標；沒估算出來（或沒走辨識）就是 null。
   * 不是精確 GPS，是依店名／地區文字的世界知識估算，見 gas/README.md。
   */
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
  /** 截圖 base64；base64 圖片之後接圖床再一起處理，目前多半留空 */
  imageUrl?: string;
  /** 辨識結果的估算座標，背景帶過去存檔用，使用者不會編輯這兩個值 */
  lat?: number | null;
  lng?: number | null;
}

/** 截圖辨識結果（Gemini 回傳，對應 spec 2.4 的辨識欄位） */
export interface RecognizedPlace {
  storeName: string;
  region: string;
  category: string;
  source: string;
  /** Gemini 依世界知識估算的大概座標；認不出來就是 null，不要硬湊 */
  lat: number | null;
  lng: number | null;
}

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isConfigured = () => API_BASE_URL.length > 0;

/**
 * 後端 record → 前端 Place。
 * lat / lng 直接帶後端的值（有辨識估算就有值，沒有就 null）。路線地圖需要座標時，
 * 由 lib/route.ts 的 placeCoord() 優先用這裡的實值，沒有才回傳假座標 fallback。
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

/** 把 `data:image/jpeg;base64,xxxx` 拆成 mimeType 跟純 base64（Gemini 要的格式） */
function splitDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('圖片格式錯誤，無法送出辨識');
  return { mimeType: match[1], base64: match[2] };
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
      lat: input.lat ?? null,
      lng: input.lng ?? null,
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

/**
 * 送截圖去後端呼叫 Gemini 辨識（對應「上傳截圖 → 開始 AI 辨識」）。
 * 呼叫端（Upload2）要自己 catch：辨識失敗時讓欄位留白給使用者手動填寫，
 * 不能讓整個流程卡住——Gemini 免費額度有請求次數限制，額度用完或服務不穩時
 * 這裡一定會丟錯，是預期中的 fallback 路徑，不是 bug。
 */
export async function recognizePlace(
  imageDataUrl: string,
): Promise<RecognizedPlace> {
  if (!isConfigured()) {
    throw new Error('尚未設定後端網址（截圖辨識需要透過後端呼叫 Gemini API）');
  }
  const { mimeType, base64 } = splitDataUrl(imageDataUrl);
  const res = await request(
    API_BASE_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'recognizePlace',
        imageBase64: base64,
        mimeType,
      }),
    },
    40000, // 後端遇到 503 會重試最多 3 次（見 gas/Code.gs），逾時要拉長一點
  );
  const json = await parseJson<ApiResponse<RecognizedPlace>>(res);
  if (!json.success) throw new Error(json.message || '辨識失敗，請手動填寫');
  return json.data;
}
