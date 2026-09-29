/**
 * yoxi「想去的地方」後端 — Google Apps Script Web App
 * 對應 reference/yoxi-PRODUCT-SPEC.md 第 2.4 節。
 *
 * ⚠️ 重要：請從「要用來當資料庫的那張 Google Sheet」的
 *    擴充功能 (Extensions) → Apps Script 建立這個腳本，
 *    這樣 SpreadsheetApp.getActiveSpreadsheet() 才抓得到試算表。
 *    如果你是用獨立 (standalone) 腳本，請把試算表 ID 填到 SPREADSHEET_ID。
 *
 * 端點：
 *   GET  ?userId=demo-user                        → 回傳該 user 的所有收藏地點（新到舊）
 *   POST body = JSON 物件（無 action，或 action
 *        不是下面兩種）                            → 新增一筆收藏地點
 *   POST body = { action: 'recognizePlace',
 *        imageBase64, mimeType }                   → 呼叫 Gemini 辨識截圖，回傳結構化欄位
 *   POST body = { action: 'recommendPlaces',
 *        lat, lng, category }                      → 呼叫 Overpass 查附近符合類別的真實地點
 *
 * 回應一律 JSON：
 *   成功  { "success": true,  "data": ... }
 *   失敗  { "success": false, "message": "說明" }
 *   （GAS 沒有真的 HTTP status code，用 success 欄位表示）
 *
 * 欄位（Places 分頁）：
 *   id / userId / storeName / region / category / source / imageUrl / lat / lng /
 *   coordSource / createdAt / visited
 *   - lat / lng：新增地點時依序嘗試「Nominatim 地理編碼查詢」（精確）→
 *     「前端帶來的 Gemini 估算座標」（大概）→ 都沒有就留空，doGet 讀出來是 null。
 *     見 handleCreatePlace_ / geocodePlace_、gas/README.md。
 *   - coordSource：內部除錯用、不給使用者看，標記這筆座標是 'geocoded'（Nominatim
 *     精確查詢）還是 'estimated'（Gemini 估算），都沒有就是空字串。
 *   - 舊的 Places 分頁如果缺這些欄位，第一次讀 / 寫時會自動補上標題（見 ensureHeaders_）。
 *
 * 截圖辨識（Gemini API）：
 *   - 金鑰放在 Script Properties（PropertiesService），不寫死在程式碼裡；
 *     設定方式見 gas/README.md。
 *   - 用的是 Google AI Studio 申請的免費額度金鑰，有請求次數限制（RPM / RPD）。
 *     如果辨識常常回「Gemini API 額度已用完」，去 Google AI Studio 的用量頁面確認額度。
 *   - 免費層常回 503「This model is currently experiencing high demand」：那是
 *     **單一模型**的容量問題，重打同一個模型幾乎一定再撞一次，所以改成依序換模型
 *     （見 GEMINI_MODELS、callGeminiWithFallback_），全部模型都失敗才回錯誤。
 */

const SHEET_NAME = 'Places';
const SPREADSHEET_ID = '1eB7pOr-a4IlwSoz7YpyY1UnnrMUfQ79PhwiTR11sf4k'; // 留空 = 用「附加在這張 Sheet 上」的試算表
const HEADERS = [
  'id',
  'userId',
  'storeName',
  'region',
  'category',
  'source',
  'imageUrl',
  'lat',
  'lng',
  'coordSource', // 內部除錯用，不給使用者看：'geocoded'（Nominatim 精確查詢）/ 'estimated'（Gemini 估算）/ ''（都沒有）
  'createdAt',
  'visited',
];
const IMAGE_MAX_LEN = 45000; // Google Sheets 單一儲存格上限約 50,000 字元

// ── 截圖辨識（Gemini API）設定 ──────────────────────────────────────────
// 依序嘗試的模型清單：**第一個成功就用它**，失敗（過載 / 額度 / 連線錯誤）就換下一個。
//
// 為什麼是清單而不是單一模型：免費層最常見的失敗是 503「This model is currently
// experiencing high demand」，那是「這個模型現在沒容量」，不是網路抖動——隔一兩秒
// 重打同一個模型幾乎一定再撞一次。換一個模型才是真正有機會成功的做法。
//
// 清單順序 = 偏好順序（前面品質較好、後面較輕量但通常比較有容量）。
// 模型若之後 deprecated，到 Google AI Studio 文件查目前可用的**多模態**模型名稱，
// 改這個陣列即可，不用動呼叫邏輯；不支援圖片輸入的模型會回 400，
// callGeminiWithFallback_ 會自動跳過換下一個，不會讓整個流程掛掉。
const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];
const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/';
// base64 字串長度上限（約 6MB 原始檔案）：避免 GAS 執行時間 / Gemini 請求大小限制炸掉。
// 前端上傳時已經先壓縮過，這裡是後端這邊的防呆，不是唯一防線。
const RECOGNIZE_IMAGE_MAX_LEN = 8000000;
// 換下一個模型前要等多久（毫秒）。純粹避免連續打太快，不需要長退避——
// 換模型本身就是在換一個不同的容量池，不是在等同一個模型變空。
const RECOGNIZE_MODEL_SWITCH_DELAY_MS = 400;
// 回應長度上限：辨識結果只有幾個短欄位，用不到太多 token。設上限可以避免
// 新模型的 thinking 內容把回應撐爆、造成 finishReason=MAX_TOKENS 的截斷 JSON。
const RECOGNIZE_MAX_OUTPUT_TOKENS = 2048;

// ── 地理編碼（Nominatim / OpenStreetMap，免費）設定 ─────────────────────────
// 使用規範重點：
//   1. 一定要帶有意義的 User-Agent 識別應用程式。
//      這是刻意把地理編碼放在後端（而不是前端 fetch）的原因：瀏覽器的 fetch/XHR
//      把 User-Agent 列為 forbidden header，JS 沒辦法自訂，瀏覽器會忽略你設的值、
//      一律送出瀏覽器自己的 UA 字串——沒辦法真的符合這條規範。GAS 的 UrlFetchApp
//      可以自訂任意 header，這裡才能真的照規範帶上有意義的 User-Agent。
//   2. 規範要求最多每秒 1 次請求。這次只有使用者按「儲存到想去的地方」時才查一次，
//      用量很小，暫時不用特別做節流；以後如果要批次 / 高流量查詢，記得在
//      geocodePlace_ 這裡加速率限制（例如用 CacheService 記上次查詢時間）。
//   3. GAS 的 UrlFetchApp 沒有可設定的逾時參數（Apps Script 本身的限制，不是我們
//      沒做），沒辦法保證嚴格幾秒內一定回來；這裡只做失敗防呆（try/catch +
//      檢查回應／結果），查詢失敗或找不到都直接回 null，不會卡住存檔流程。
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_USER_AGENT =
  'yoxi-app/1.0 (hackathon demo; https://github.com/ZeroOneThree013/yoxi-app)';

// ── 依偏好推薦（Overpass API / OpenStreetMap，免費，不需要金鑰）設定 ─────────
// spec 原本規劃放前端直接呼叫（Overpass 官方沒有像 Nominatim 那樣強制要求
// User-Agent，理論上瀏覽器可以直接打）。但實測時這個環境對 overpass-api.de
// 的請求一律被擋（連最簡單的 GET /api/status 都回 406，Nominatim 走的是同一個
// OSM 生態圈卻完全正常，判斷是 Overpass 的防濫用機制擋掉了這個環境的出口 IP）。
// 沒辦法從瀏覽器端驗證 CORS 是否真的可行，保險起見改放後端呼叫，做法比照
// 地理編碼：GAS 的出口 IP 比較不會被這類公開服務的防濫用機制擋掉。
//
// 後來連 GAS 自己的出口 IP（Google 雲端）也被 overpass-api.de 擋了
// （UrlFetchApp 直接丟「無法開啟網址」的例外）。Overpass 是社群維運的免費
// 服務，沒有官方 SLA，個別鏡像站隨時可能限制特定來源 IP 或暫時不穩，
// 所以這裡改成「多鏡像依序容錯」：依序嘗試 OVERPASS_URLS 清單，
// 連線失敗或回應格式不對就換下一個，全部都失敗才真的回錯誤給前端。
// 如果哪天這幾個鏡像全部都不能用了，去
// https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
// 找目前還在維運的鏡像站，加進這個陣列即可，不用動下面的重試邏輯。
// 依序嘗試的鏡像。注意：這些都是社群維運的免費服務，可用性會隨時間變動，
// **清單順序需要定期用 testOverpassMirrors() 重新驗證**（見下方那個函式）。
const OVERPASS_URLS = [
  'https://overpass.nchc.org.tw/api/interpreter', // 台灣國網中心；地理位置最近，對台灣查詢最合適
  'https://overpass.kumi.systems/api/interpreter', // 社群大站，容量大但也常被打爆
  'https://overpass-api.de/api/interpreter', // 官方主站，最常壅塞，放最後當備援
];

// testOverpassMirrors() 會「額外」一起測的候選鏡像。
// 想換鏡像時，先跑 testOverpassMirrors() 看哪個在 GAS 端又快又有台灣資料，
// 再把它移進上面的 OVERPASS_URLS。
//
// 選鏡像的兩個陷阱（實測踩過）：
//   1. 有些是「單一國家」的區域性實例，例如 overpass.osm.ch 只收錄瑞士資料：
//      查台北會回 HTTP 200 但 0 筆，看起來正常其實完全不能用。
//   2. 從瀏覽器測會被 CORS 擋（看起來像掛了），但 GAS 沒有 CORS 限制可能完全正常，
//      所以一定要用 testOverpassMirrors() 從 GAS 端測，不要只在瀏覽器試。
const OVERPASS_CANDIDATE_URLS = [
  'https://overpass.osm.jp/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// 查詢總時間預算（毫秒）。GAS 的 UrlFetchApp 沒有逾時參數，沒辦法叫單一鏡像
// 「幾秒內一定要回」；能做的是跑完一個鏡像後檢查已用時間，超過就不再試下一個。
// 實測過三個鏡像全掛時串聯要 137 秒，遠超過前端逾時，使用者只是白等。
const OVERPASS_TIME_BUDGET_MS = 40000;
const OVERPASS_RADIUS_M = 4000; // 3-5 公里，取中間值
const OVERPASS_USER_AGENT =
  'yoxi-app/1.0 (hackathon demo; https://github.com/ZeroOneThree013/yoxi-app)';
// Overpass 查回來的 POI 上限（排序 / 取前幾筆交給前端 lib/recommendations.ts，
// 這裡只是避免回應太肥）
const OVERPASS_MAX_RESULTS = 20;

const RECOGNIZE_PROMPT = [
  '你是一個從社群媒體或地圖 App 的手機截圖中擷取地點資訊的助理。',
  '使用者上傳的截圖可能來自 Instagram、Facebook 或 Google Maps，',
  '畫面中可能包含餐廳、咖啡廳、店家或景點的資訊。',
  '',
  '請只輸出一個 JSON 物件，不要有任何其他文字、不要用 markdown code fence，欄位如下：',
  '{',
  '  "storeName": "店名，看不出來就填空字串",',
  '  "region": "地區，格式例如「台南市中西區」；只看得出城市就填城市；完全看不出來就填空字串",',
  '  "category": "地點種類的簡短分類，例如「咖啡廳」「餐廳」「選物 / 逛街」「戶外 / 走走」；看不出來就填「未分類」",',
  '  "source": "只能是「Instagram」「Facebook」「Google Maps」其中之一，依畫面上的 UI 特徵判斷；判斷不出來就填「截圖上傳」",',
  '  "lat": 緯度數字或 null,',
  '  "lng": 經度數字或 null',
  '}',
  '',
  'lat / lng 請依你自己對這個店名與地區的世界知識，估算這個地點大概的座標（WGS84）。',
  '這兩個欄位一定要是 JSON 數字或 JSON null，不要用字串、不要加引號。',
  '如果你認不出具體是哪個地點、沒有把握給出合理估算，兩個都填 null，不要硬湊或亂猜一個數字。',
].join('\n');

/* ─────────────── 試算表 / sheet ─────────────── */

function getSpreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      '抓不到試算表：請從目標 Sheet 的 Extensions → Apps Script 建立腳本，或在 SPREADSHEET_ID 填入試算表 ID',
    );
  }
  return ss;
}

/**
 * 確保標題列存在且完整。
 * - 全新 / 空的 sheet：寫入完整 HEADERS。
 * - 已有資料但缺欄位（例如舊版沒有 lat / lng）：把缺的欄位「附加到現有標題列尾端」，
 *   不動既有資料欄位順序，舊資料列在新欄位就是空值。
 */
function ensureHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0 || sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });
  const missing = HEADERS.filter(function (h) {
    return current.indexOf(h) === -1;
  });
  if (missing.length) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
  if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  ensureHeaders_(sheet);
  return sheet;
}

/* ─────────────── 回應 helper ─────────────── */

function jsonOk_(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, data: data }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, message: String(message) }),
  ).setMimeType(ContentService.MimeType.JSON);
}

/* ─────────────── 型別轉換 ─────────────── */

/** 空值 → null；否則盡量轉數字；轉不動也回 null（不讓前端解析數字時壞掉） */
function numOrNull_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** 存進儲存格用：null / undefined / 空 / 非數字 → 空字串；否則數字 */
function numOrBlank_(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

/* ─────────────── 讀取 ─────────────── */

function readAll_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0].map(function (h) {
    return String(h).trim();
  });
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.join('') === '') continue; // 跳過整列空白
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      if (!header[c]) continue;
      obj[header[c]] = row[c];
    }
    obj.id = String(obj.id);
    obj.userId = String(obj.userId);
    obj.visited =
      obj.visited === true || String(obj.visited).toLowerCase() === 'true';
    obj.lat = numOrNull_(obj.lat); // 空欄位 → null
    obj.lng = numOrNull_(obj.lng);
    if (obj.createdAt instanceof Date) {
      obj.createdAt = obj.createdAt.toISOString();
    } else {
      obj.createdAt = obj.createdAt ? String(obj.createdAt) : '';
    }
    rows.push(obj);
  }
  return rows;
}

/* ─────────────── 寫入（欄位順序照現有標題列，相容舊 sheet） ─────────────── */

function appendRecord_(sheet, record) {
  const lastCol = sheet.getLastColumn();
  const header = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });
  const row = header.map(function (h) {
    return Object.prototype.hasOwnProperty.call(record, h) ? record[h] : '';
  });
  sheet.appendRow(row);
}

/* ─────────────── doGet：清單 ─────────────── */

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const userId = params.userId ? String(params.userId).trim() : '';
    if (!userId) return jsonError_('缺少必要參數：userId');

    const sheet = getSheet_();
    const mine = readAll_(sheet).filter(function (p) {
      return p.userId === userId;
    });
    mine.sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    return jsonOk_(mine);
  } catch (err) {
    return jsonError_('讀取失敗：' + (err && err.message ? err.message : err));
  }
}

/* ─────────────── doPost：依 action 分流 ─────────────── */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonError_('缺少請求內容 (request body)');
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonError_('請求內容不是合法的 JSON');
    }

    if (body.action === 'recognizePlace') {
      return handleRecognizePlace_(body);
    }
    if (body.action === 'recommendPlaces') {
      return handleRecommendPlaces_(body);
    }
    return handleCreatePlace_(body);
  } catch (err) {
    return jsonError_('處理請求失敗：' + (err && err.message ? err.message : err));
  }
}

/* ─────────────── 新增收藏地點 ─────────────── */

function handleCreatePlace_(body) {
  try {
    const userId = body.userId ? String(body.userId).trim() : '';
    const storeName = body.storeName ? String(body.storeName).trim() : '';
    const region = body.region ? String(body.region).trim() : '';
    const category = body.category ? String(body.category).trim() : '';
    const source = body.source ? String(body.source).trim() : '';
    let imageUrl = body.imageUrl ? String(body.imageUrl) : '';

    const missing = [];
    if (!userId) missing.push('userId');
    if (!storeName) missing.push('storeName');
    if (!category) missing.push('category');
    if (missing.length) {
      return jsonError_('缺少必要欄位：' + missing.join('、'));
    }

    // 圖片太大塞不進儲存格就先略過（之後接圖床／VLM 再處理）
    if (imageUrl.length > IMAGE_MAX_LEN) imageUrl = '';

    // 座標優先順序：Nominatim 精確查詢 > 前端帶來的 Gemini 估算 > 都沒有（留空）。
    // coordSource 是內部除錯用的註記，不給使用者看。
    let lat = numOrBlank_(body.lat);
    let lng = numOrBlank_(body.lng);
    let coordSource = lat !== '' && lng !== '' ? 'estimated' : '';

    const geocoded = geocodePlace_(storeName, region);
    if (geocoded) {
      lat = geocoded.lat;
      lng = geocoded.lng;
      coordSource = 'geocoded';
    }

    const record = {
      id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      userId: userId,
      storeName: storeName,
      region: region,
      category: category,
      source: source,
      imageUrl: imageUrl,
      lat: lat,
      lng: lng,
      coordSource: coordSource,
      createdAt: new Date().toISOString(),
      visited: body.visited === true,
    };

    const sheet = getSheet_();

    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // Sheets 並發寫入容易鎖住，加鎖保險
    try {
      appendRecord_(sheet, record);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    // 回傳給前端的格式：空值一律回 null
    record.lat = numOrNull_(record.lat);
    record.lng = numOrNull_(record.lng);
    return jsonOk_(record);
  } catch (err) {
    return jsonError_('寫入失敗：' + (err && err.message ? err.message : err));
  }
}

/**
 * 用「店名 + 地區」查 Nominatim，找到就回精確座標 { lat, lng }，
 * 查無結果 / 請求失敗都回 null——呼叫端會 fallback 回 Gemini 估算的座標，
 * 不會因為這裡失敗卡住存檔流程。使用規範細節見上方 NOMINATIM_* 常數註解。
 */
function geocodePlace_(storeName, region) {
  const query = [storeName, region]
    .filter(function (s) {
      return s;
    })
    .join(' ')
    .trim();
  if (!query) return null;

  try {
    const url =
      NOMINATIM_URL + '?format=json&limit=1&q=' + encodeURIComponent(query);
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log(
        'Nominatim 查詢非 200（' + res.getResponseCode() + '），query=' + query,
      );
      return null;
    }

    const results = JSON.parse(res.getContentText());
    if (!results || !results.length) {
      Logger.log('Nominatim 查無結果，query=' + query);
      return null;
    }

    const lat = Number(results[0].lat);
    const lng = Number(results[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;

    Logger.log('Nominatim 查到座標，query=' + query + ' → ' + lat + ',' + lng);
    return { lat: lat, lng: lng };
  } catch (err) {
    Logger.log(
      'Nominatim 查詢失敗：' + (err && err.message ? err.message : err),
    );
    return null;
  }
}

/* ─────────────── 截圖辨識（Gemini API） ─────────────── */

/**
 * 依序拿 GEMINI_MODELS 裡的模型去打同一份 payload，第一個「真的拿到可用文字」
 * 的模型就回傳結果；任何一種失敗都換下一個模型繼續試。
 *
 * 會換下一個模型的情況（全部都算「這個模型現在不能用」，不是致命錯誤）：
 *   - HTTP 503：模型過載（免費層最常見，訊息是 high demand）
 *   - HTTP 429：這個模型的額度 / 頻率上限（配額是分模型算的，換一個有機會成功）
 *   - HTTP 400 等：例如這個模型不吃圖片輸入
 *   - 連線層級例外、回傳不是 JSON、沒有 candidates
 *   - finishReason 不是 STOP：回應被截斷（例如 MAX_TOKENS），JSON 會不完整
 *
 * 回傳 { text, model } 表示成功；回傳 { problems } 表示全部模型都失敗，
 * problems 是每個模型各自的失敗原因（給錯誤訊息用，方便之後排查）。
 */
function callGeminiWithFallback_(payload, apiKey) {
  const problems = [];

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    if (i > 0) Utilities.sleep(RECOGNIZE_MODEL_SWITCH_DELAY_MS);

    let res;
    try {
      res = UrlFetchApp.fetch(GEMINI_API_BASE + model + ':generateContent', {
        method: 'post',
        contentType: 'application/json',
        // 金鑰放 header 不放 query string：避免 API key 被寫進執行記錄的網址裡
        headers: { 'x-goog-api-key': apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
    } catch (fetchErr) {
      problems.push({
        model: model,
        code: 0,
        message: '連線失敗：' + (fetchErr && fetchErr.message ? fetchErr.message : fetchErr),
      });
      continue;
    }

    const code = res.getResponseCode();
    const text = res.getContentText();

    if (code < 200 || code >= 300) {
      let apiMessage = '';
      try {
        const errJson = JSON.parse(text);
        apiMessage = (errJson.error && errJson.error.message) || '';
      } catch (ignored) {
        // 回應不是 JSON 就用原始文字，截短避免訊息爆掉
      }
      problems.push({
        model: model,
        code: code,
        message: apiMessage || text.slice(0, 200),
      });
      continue;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      problems.push({ model: model, code: code, message: '回應不是合法 JSON' });
      continue;
    }

    const candidate = json.candidates && json.candidates[0];
    if (!candidate) {
      problems.push({ model: model, code: code, message: '沒有回傳任何結果' });
      continue;
    }
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      problems.push({
        model: model,
        code: code,
        message: '回應不完整（finishReason=' + candidate.finishReason + '）',
      });
      continue;
    }

    const replyText = extractGeminiText_(json);
    if (!replyText) {
      problems.push({ model: model, code: code, message: '回傳空內容' });
      continue;
    }

    return { text: replyText, model: model };
  }

  return { problems: problems };
}

/** 把每個模型的失敗原因組成一行，給錯誤訊息用 */
function describeGeminiProblems_(problems) {
  return problems
    .map(function (p) {
      return p.model + '（' + (p.code ? 'HTTP ' + p.code : '連線錯誤') + '）：' + p.message;
    })
    .join('；');
}

function handleRecognizePlace_(body) {
  try {
    const imageBase64 = body.imageBase64 ? String(body.imageBase64) : '';
    const mimeType = body.mimeType ? String(body.mimeType) : 'image/jpeg';

    if (!imageBase64) return jsonError_('缺少圖片資料 (imageBase64)');
    if (imageBase64.length > RECOGNIZE_IMAGE_MAX_LEN) {
      return jsonError_('圖片太大，請使用較小或壓縮過的截圖');
    }

    const apiKey = PropertiesService.getScriptProperties().getProperty(
      'GEMINI_API_KEY',
    );
    if (!apiKey) {
      return jsonError_(
        '後端尚未設定 GEMINI_API_KEY（指令碼屬性），見 gas/README.md 的設定步驟',
      );
    }

    const payload = {
      contents: [
        {
          parts: [
            { text: RECOGNIZE_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: RECOGNIZE_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    };

    const attempt = callGeminiWithFallback_(payload, apiKey);

    if (!attempt.text) {
      const problems = attempt.problems || [];
      const allOverloaded =
        problems.length > 0 &&
        problems.every(function (p) {
          return p.code === 503;
        });
      const anyQuota = problems.some(function (p) {
        return p.code === 429;
      });

      if (allOverloaded) {
        return jsonError_(
          'Gemini 目前所有備援模型都過載中（' +
            GEMINI_MODELS.length +
            ' 個模型都回 HTTP 503），這通常是短暫的，請稍等一下再按一次「重新辨識」',
        );
      }
      if (anyQuota) {
        return jsonError_(
          'Gemini API 額度已用完或請求過於頻繁（HTTP 429），請稍後再試，' +
            '或到 Google AI Studio 檢查用量。各模型狀況：' +
            describeGeminiProblems_(problems),
        );
      }
      return jsonError_(
        '呼叫 Gemini API 失敗（已試過 ' +
          GEMINI_MODELS.length +
          ' 個模型）：' +
          describeGeminiProblems_(problems),
      );
    }

    const parsed = extractJsonObject_(attempt.text);
    if (!parsed) return jsonError_('辨識失敗，請手動填寫');

    const latLng = sanitizeLatLng_(parsed.lat, parsed.lng);

    return jsonOk_({
      storeName: parsed.storeName ? String(parsed.storeName).trim() : '',
      region: parsed.region ? String(parsed.region).trim() : '',
      category: parsed.category ? String(parsed.category).trim() : '',
      source: normalizeSource_(parsed.source),
      lat: latLng.lat,
      lng: latLng.lng,
    });
  } catch (err) {
    return jsonError_('辨識失敗：' + (err && err.message ? err.message : err));
  }
}

/**
 * 從 Gemini generateContent 回應裡取出文字內容。
 *
 * 會跳過 thought 為 true 的 part：新的模型會把推理過程也放進 parts，
 * 那段不是我們要的 JSON，混進來會讓後面的 JSON 解析直接失敗。
 */
function extractGeminiText_(geminiJson) {
  try {
    const candidates = geminiJson.candidates || [];
    for (let i = 0; i < candidates.length; i++) {
      const parts = candidates[i].content && candidates[i].content.parts;
      if (parts && parts.length) {
        const t = parts
          .map(function (p) {
            if (p.thought) return '';
            return p.text || '';
          })
          .join('');
        if (t) return t;
      }
    }
  } catch (err) {
    // 忽略，外層會當作辨識失敗處理
  }
  return '';
}

/**
 * 防呆：Gemini 理論上會因為 responseMimeType: 'application/json' 只回純 JSON，
 * 但還是可能夾雜文字或用 code fence 包起來，這裡盡量把 {...} 區塊挖出來解析。
 * 解析不出來就回 null，呼叫端會回「辨識失敗，請手動填寫」，不會讓流程掛掉。
 */
function extractJsonObject_(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err2) {
        return null;
      }
    }
    return null;
  }
}

function normalizeSource_(v) {
  const s = v ? String(v).trim() : '';
  if (s === 'Instagram' || s === 'Facebook' || s === 'Google Maps') return s;
  return '截圖上傳';
}

/**
 * Gemini 估算的 lat / lng 防呆：兩個都要是合理範圍內的數字才算數。
 * 缺一個、型別不對、或超出經緯度合理範圍，就兩個都當作沒有（null），
 * 不要讓半吊子或亂猜的座標混進 Places 表。
 */
function sanitizeLatLng_(latRaw, lngRaw) {
  const lat = numOrNull_(latRaw);
  const lng = numOrNull_(lngRaw);
  if (lat === null || lng === null) return { lat: null, lng: null };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { lat: null, lng: null };
  }
  return { lat: lat, lng: lng };
}

/* ─────────────── 依偏好推薦（Overpass API） ─────────────── */

/**
 * 把（Gemini 辨識出來的自由文字）類別對應到 Overpass 查詢用的 OSM tag。
 * 對照不到的類別一律用 amenity=cafe 當合理預設。
 */
function categoryToOsmTag_(category) {
  const c = String(category || '');
  if (c.indexOf('咖啡') !== -1) return { key: 'amenity', value: 'cafe' };
  if (
    c.indexOf('餐廳') !== -1 ||
    c.indexOf('美食') !== -1 ||
    c.indexOf('燒肉') !== -1 ||
    c.indexOf('小吃') !== -1
  ) {
    return { key: 'amenity', value: 'restaurant' };
  }
  if (c.indexOf('甜') !== -1 || c.indexOf('冰') !== -1) {
    return { key: 'amenity', value: 'ice_cream' };
  }
  if (c.indexOf('海') !== -1) return { key: 'natural', value: 'beach' };
  if (
    c.indexOf('戶外') !== -1 ||
    c.indexOf('走走') !== -1 ||
    c.indexOf('公園') !== -1
  ) {
    return { key: 'leisure', value: 'park' };
  }
  if (
    c.indexOf('逛街') !== -1 ||
    c.indexOf('選物') !== -1 ||
    c.indexOf('購物') !== -1
  ) {
    return { key: 'shop', value: null }; // value 是 null = 只要有 shop 這個 tag 就算，不限種類
  }
  return { key: 'amenity', value: 'cafe' };
}

/** 組 Overpass QL：查 node/way，半徑 OVERPASS_RADIUS_M 內符合 tag 的地點 */
function buildOverpassQuery_(tag, lat, lng) {
  const filter = tag.value
    ? '["' + tag.key + '"="' + tag.value + '"]'
    : '["' + tag.key + '"]';
  const around = '(around:' + OVERPASS_RADIUS_M + ',' + lat + ',' + lng + ')';
  return (
    '[out:json][timeout:20];' +
    '(node' +
    filter +
    around +
    ';way' +
    filter +
    around +
    ';);' +
    'out center ' +
    OVERPASS_MAX_RESULTS +
    ';'
  );
}

/**
 * 依序嘗試 OVERPASS_URLS 清單裡的每個鏡像，直到有一個成功回傳可用的資料。
 * 「成功」＝ HTTP 200 + 回應是合法 JSON + 有 elements 陣列；連線失敗、非 200、
 * JSON 壞掉、格式不對，都算這個鏡像失敗，換下一個試。
 * 全部鏡像都失敗回傳 null——呼叫端只需要顯示一個籠統的失敗訊息，
 * 不用列出每個鏡像個別的失敗原因（避免訊息太長）。
 * 每個鏡像的成功 / 失敗都會寫 Logger.log，方便到 Executions 頁面除錯。
 */
function fetchOverpassData_(query) {
  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { 'User-Agent': OVERPASS_USER_AGENT },
    payload: 'data=' + encodeURIComponent(query),
    muteHttpExceptions: true,
  };

  const startedAt = Date.now();
  const problems = [];

  for (let i = 0; i < OVERPASS_URLS.length; i++) {
    const url = OVERPASS_URLS[i];

    // 時間預算：UrlFetchApp 沒有逾時參數（GAS 限制），單一鏡像卡住就是卡住，
    // 但至少不要讓「一個一個慢慢卡」累加成好幾分鐘。實測過三個鏡像全部不可用時
    // 串聯下來要 137 秒，前端早就逾時了，使用者只會看到一個沒有資訊的失敗訊息。
    // 跑完一個鏡像就檢查一次已用時間，超過預算就不再試下一個，直接回失敗。
    const elapsed = Date.now() - startedAt;
    if (i > 0 && elapsed > OVERPASS_TIME_BUDGET_MS) {
      Logger.log(
        '已用 ' + elapsed + 'ms 超過預算，放棄剩下 ' +
          (OVERPASS_URLS.length - i) + ' 個鏡像',
      );
      problems.push('（已達時間預算，未再嘗試剩下的鏡像）');
      break;
    }

    const attemptAt = Date.now();
    let res;
    try {
      res = UrlFetchApp.fetch(url, options);
    } catch (fetchErr) {
      const ms = Date.now() - attemptAt;
      Logger.log('Overpass 鏡像連線失敗（' + url + '，' + ms + 'ms）：' +
        (fetchErr && fetchErr.message ? fetchErr.message : fetchErr));
      problems.push(shortMirrorName_(url) + ' 連線失敗');
      continue;
    }

    const ms = Date.now() - attemptAt;
    const code = res.getResponseCode();
    if (code !== 200) {
      Logger.log('Overpass 鏡像回應異常（' + url + '，' + ms + 'ms）：HTTP ' + code);
      problems.push(shortMirrorName_(url) + ' HTTP ' + code);
      continue;
    }

    let data;
    try {
      data = JSON.parse(res.getContentText());
    } catch (parseErr) {
      Logger.log('Overpass 鏡像回應不是合法 JSON（' + url + '，' + ms + 'ms）');
      problems.push(shortMirrorName_(url) + ' 回應不是 JSON');
      continue;
    }

    if (!data || !Array.isArray(data.elements)) {
      Logger.log('Overpass 鏡像回應格式不對，缺少 elements（' + url + '）');
      problems.push(shortMirrorName_(url) + ' 回應格式不對');
      continue;
    }

    Logger.log('Overpass 查詢成功，使用鏡像：' + url + '（' + ms + 'ms）');
    return { data: data };
  }

  return { problems: problems }; // 全部鏡像都失敗（或提前用完時間預算）
}

/** 把鏡像網址縮成好讀的名字，用在回給前端的錯誤訊息裡 */
function shortMirrorName_(url) {
  const m = /^https?:\/\/([^/]+)/.exec(url);
  return m ? m[1] : url;
}

/**
 * 手動測試用：在 Apps Script 編輯器選這個函式按 Run，看 Executions 的 log，
 * 就能知道「從 GAS 出去」實際連得到哪些 Overpass 鏡像、各花多久。
 *
 * 為什麼需要這個：從瀏覽器測不準。部分鏡像（例如台灣國網 overpass.nchc.org.tw）
 * 會被瀏覽器的 CORS 擋掉而看起來「失敗」，但 GAS 沒有 CORS 限制，可能完全可用；
 * 反過來也有鏡像擋 GAS 的出口 IP。要換 OVERPASS_URLS 的順序前先跑這個。
 */
function testOverpassMirrors() {
  const candidates = OVERPASS_URLS.concat(OVERPASS_CANDIDATE_URLS);
  // 很小的查詢，只為了測連線，不是真的要資料
  const query =
    '[out:json][timeout:10];node["amenity"="cafe"](around:800,25.0438,121.5346);out 3;';
  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers: { 'User-Agent': OVERPASS_USER_AGENT },
    payload: 'data=' + encodeURIComponent(query),
    muteHttpExceptions: true,
  };

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    const t0 = Date.now();
    try {
      const res = UrlFetchApp.fetch(url, options);
      const ms = Date.now() - t0;
      let count = -1;
      try {
        const parsed = JSON.parse(res.getContentText());
        count = (parsed.elements || []).length;
      } catch (e) {
        // 不是 JSON，count 維持 -1
      }
      Logger.log(
        url + ' → HTTP ' + res.getResponseCode() + '，' + ms + 'ms，' +
          (count >= 0 ? '台北 800m 內查到 ' + count + ' 筆' : '回應不是 JSON'),
      );
    } catch (err) {
      Logger.log(url + ' → 連線失敗（' + (Date.now() - t0) + 'ms）：' +
        (err && err.message ? err.message : err));
    }
  }
  Logger.log(
    '提示：挑「HTTP 200 + 有查到筆數 + 秒數短」的鏡像放進 OVERPASS_URLS 最前面。' +
      '查到 0 筆代表那個鏡像沒有台灣資料（例如只收錄單一國家的區域性實例），不能用。',
  );
}

function handleRecommendPlaces_(body) {
  try {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const category = body.category ? String(body.category).trim() : '';
    if (isNaN(lat) || isNaN(lng)) {
      return jsonError_('缺少或不合法的 lat / lng');
    }

    const tag = categoryToOsmTag_(category);
    const query = buildOverpassQuery_(tag, lat, lng);

    const result = fetchOverpassData_(query);
    if (!result.data) {
      // 把每個鏡像各自的失敗原因帶回前端：以前只回一句籠統的「都連線失敗」，
      // 線上出問題時完全看不出是哪個鏡像、什麼原因，只能猜。
      const detail = (result.problems || []).join('、');
      return jsonError_(
        '附近地點查詢失敗：地圖資料來源（Overpass）目前都連不上' +
          (detail ? '（' + detail + '）' : '') +
          '。這是免費公共服務的暫時性壅塞，請稍後再試',
      );
    }

    const elements = result.data.elements || [];
    const pois = [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tags = el.tags || {};
      if (!tags.name) continue; // 沒有名字的 POI 對使用者沒意義，跳過

      const elLat = el.lat != null ? el.lat : el.center && el.center.lat;
      const elLng = el.lon != null ? el.lon : el.center && el.center.lon;
      if (elLat == null || elLng == null) continue;

      const addressParts = [
        tags['addr:city'],
        tags['addr:district'] || tags['addr:suburb'],
      ].filter(function (s) {
        return s;
      });

      pois.push({
        id: 'osm_' + el.type + '_' + el.id,
        name: String(tags.name),
        lat: elLat,
        lng: elLng,
        address: addressParts.join(''),
      });
    }

    return jsonOk_(pois);
  } catch (err) {
    return jsonError_(
      '查詢附近推薦地點失敗：' + (err && err.message ? err.message : err),
    );
  }
}

function testAuth() {
  const response = UrlFetchApp.fetch('https://www.google.com');
  Logger.log(response.getResponseCode());
}