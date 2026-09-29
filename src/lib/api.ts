import { API_BASE_URL, DEMO_USER_ID } from '../config';
import { MOCK_PLACES } from '../data/mock';
import type { Coord, Place } from '../types';

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
   * 新增時後端依序嘗試：Nominatim 地理編碼查詢（精確）→ 這裡送來的 Gemini
   * 估算座標（大概）→ 都沒有就是 null。實際用哪個由後端決定，見 gas/README.md。
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
  /**
   * 辨識結果的估算座標，背景帶過去存檔用，使用者不會編輯這兩個值。
   * 後端存檔前會先試 Nominatim 精確查詢，查得到就會覆蓋掉這裡送的估算值——
   * 這兩個欄位是「查不到時的備援」，不是最終一定會用的值。
   */
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

/** Overpass 查到的一個真實 POI（後端回傳格式，對應 spec 2.5「依偏好推薦」） */
export interface NearbyPoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 最好情況下的地址片段（依 OSM addr:* 標籤組出來），查不到就是空字串 */
  address: string;
}

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isConfigured = () => API_BASE_URL.length > 0;

/**
 * 後端 record → 前端 Place。
 * lat / lng 直接帶後端的值（Nominatim 查到就是精確值，查不到用 Gemini 估算，
 * 都沒有就 null）。路線地圖需要座標時，由 lib/route.ts 的 placeCoord() 優先用
 * 這裡的實值，沒有才回傳假座標 fallback。
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
    20000, // 後端這次會多打一次 Nominatim 地理編碼，逾時拉長一點
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
    // 後端遇到 503 最多重試 3 次（見 gas/Code.gs 的 fetchGeminiWithRetry_），
    // 每次都是真的打一次 Gemini 多模態請求，免費層過載時單次就可能要十幾秒；
    // 40 秒撐不住「3 次都變慢」的最壞狀況，前端會在後端還在重試時就先判定逾時、
    // 顯示「連線逾時」——即使後端其實快成功了。拉長到 90 秒，留給 3 次重試足夠時間。
    90000,
  );
  const json = await parseJson<ApiResponse<RecognizedPlace>>(res);
  if (!json.success) throw new Error(json.message || '辨識失敗，請手動填寫');
  return json.data;
}

/**
 * 查使用者附近符合偏好類別的真實地點（對應「選擇任務地點」畫面的
 * 「依偏好推薦」分頁，spec 2.5）。後端用 Overpass API（OpenStreetMap）查詢，
 * 這裡只負責把結果拿回來——distance 排序、reason 文案由 lib/recommendations.ts
 * 處理（避免重複實作距離計算）。
 *
 * 查詢失敗 / 逾時就丟錯，呼叫端要顯示乾淨的失敗或空狀態，
 * **不可以** fallback 回任何寫死的假地點。
 */
export async function fetchNearbyPois(
  origin: Coord,
  category: string,
): Promise<NearbyPoi[]> {
  if (!isConfigured()) {
    throw new Error('尚未設定後端網址（依偏好推薦需要透過後端查詢附近地點）');
  }
  const res = await request(
    API_BASE_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'recommendPlaces',
        lat: origin.lat,
        lng: origin.lng,
        category,
      }),
    },
    // 120 秒。這個值不是憑感覺調的，是照實測來的：2026-09-29 用 GAS 端的
    // testOverpassMirrors() 測過所有鏡像，目前**唯一可用**的 kumi.systems
    // 本身就要 76.8 秒才回應（Overpass 公共服務壅塞，不是我們的程式慢）。
    // 逾時設得比它短（先前是 55 秒）的話，後端其實查成功了，前端卻已經放棄，
    // 使用者只會看到「查詢失敗」——這正是之前一直失敗的原因。
    //
    // 後端有 OVERPASS_TIME_BUDGET_MS（100 秒）的總預算，最壞情況約 78 秒，
    // 這裡留到 120 秒當緩衝。另外後端已加上 6 小時快取，同一區域第二次查詢
    // 會直接命中快取秒回，不會每次都等這麼久。
    120000,
  );
  const json = await parseJson<ApiResponse<NearbyPoi[]>>(res);
  if (!json.success) throw new Error(json.message || '查詢附近推薦地點失敗');
  return json.data;
}
