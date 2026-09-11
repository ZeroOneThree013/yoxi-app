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
 *   POST body = JSON 物件（無 action / action 不是
 *        'recognizePlace'）                        → 新增一筆收藏地點
 *   POST body = { action: 'recognizePlace',
 *        imageBase64, mimeType }                   → 呼叫 Gemini 辨識截圖，回傳結構化欄位
 *
 * 回應一律 JSON：
 *   成功  { "success": true,  "data": ... }
 *   失敗  { "success": false, "message": "說明" }
 *   （GAS 沒有真的 HTTP status code，用 success 欄位表示）
 *
 * 欄位（Places 分頁）：
 *   id / userId / storeName / region / category / source / imageUrl / lat / lng / createdAt / visited
 *   - lat / lng 是「預留欄位」：目前沒有座標來源，前端不會送、後端一律存空值、
 *     doGet 讀出來是 null。之後接「截圖辨識取得座標」或「地區文字 geocoding」才會真的填。
 *   - 舊的 Places 分頁如果沒有這兩欄，第一次讀 / 寫時會自動補上標題（見 ensureHeaders_）。
 *
 * 截圖辨識（Gemini API）：
 *   - 金鑰放在 Script Properties（PropertiesService），不寫死在程式碼裡；
 *     設定方式見 gas/README.md。
 *   - 用的是 Google AI Studio 申請的免費額度金鑰，有請求次數限制（RPM / RPD）。
 *     如果辨識常常回「Gemini API 額度已用完」，去 Google AI Studio 的用量頁面確認額度。
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
  'createdAt',
  'visited',
];
const IMAGE_MAX_LEN = 45000; // Google Sheets 單一儲存格上限約 50,000 字元

// ── 截圖辨識（Gemini API）設定 ──────────────────────────────────────────
// 如果這個 model 之後 deprecated，到 Google AI Studio 文件查目前可用的多模態
// model 名稱，改這裡即可，不用動呼叫邏輯。
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  GEMINI_MODEL +
  ':generateContent';
// base64 字串長度上限（約 6MB 原始檔案）：避免 GAS 執行時間 / Gemini 請求大小限制炸掉。
// 前端上傳時已經先壓縮過，這裡是後端這邊的防呆，不是唯一防線。
const RECOGNIZE_IMAGE_MAX_LEN = 8000000;

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
  '  "source": "只能是「Instagram」「Facebook」「Google Maps」其中之一，依畫面上的 UI 特徵判斷；判斷不出來就填「截圖上傳」"',
  '}',
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

    const record = {
      id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      userId: userId,
      storeName: storeName,
      region: region,
      category: category,
      source: source,
      imageUrl: imageUrl,
      // lat / lng 是可選欄位：前端目前不會送，沒有就存空字串
      lat: numOrBlank_(body.lat),
      lng: numOrBlank_(body.lng),
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

/* ─────────────── 截圖辨識（Gemini API） ─────────────── */

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
        responseMimeType: 'application/json',
      },
    };

    let res;
    try {
      res = UrlFetchApp.fetch(
        GEMINI_API_URL + '?key=' + encodeURIComponent(apiKey),
        {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        },
      );
    } catch (fetchErr) {
      return jsonError_(
        '呼叫 Gemini API 失敗：' +
          (fetchErr && fetchErr.message ? fetchErr.message : fetchErr),
      );
    }

    const code = res.getResponseCode();
    const text = res.getContentText();

    if (code === 429) {
      return jsonError_(
        'Gemini API 額度已用完或請求過於頻繁（HTTP 429），請稍後再試，' +
          '或到 Google AI Studio 檢查用量',
      );
    }
    if (code < 200 || code >= 300) {
      return jsonError_(
        'Gemini API 回應異常（HTTP ' + code + '）：' + text.slice(0, 300),
      );
    }

    let geminiJson;
    try {
      geminiJson = JSON.parse(text);
    } catch (parseErr) {
      return jsonError_('Gemini API 回應不是合法 JSON');
    }

    const replyText = extractGeminiText_(geminiJson);
    if (!replyText) return jsonError_('辨識失敗，請手動填寫');

    const parsed = extractJsonObject_(replyText);
    if (!parsed) return jsonError_('辨識失敗，請手動填寫');

    return jsonOk_({
      storeName: parsed.storeName ? String(parsed.storeName).trim() : '',
      region: parsed.region ? String(parsed.region).trim() : '',
      category: parsed.category ? String(parsed.category).trim() : '',
      source: normalizeSource_(parsed.source),
    });
  } catch (err) {
    return jsonError_('辨識失敗：' + (err && err.message ? err.message : err));
  }
}

/** 從 Gemini generateContent 回應裡取出文字內容 */
function extractGeminiText_(geminiJson) {
  try {
    const candidates = geminiJson.candidates || [];
    for (let i = 0; i < candidates.length; i++) {
      const parts = candidates[i].content && candidates[i].content.parts;
      if (parts && parts.length) {
        const t = parts
          .map(function (p) {
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

function testAuth() {
  const response = UrlFetchApp.fetch('https://www.google.com');
  Logger.log(response.getResponseCode());
}