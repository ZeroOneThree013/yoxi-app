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
 *   GET  ?userId=demo-user        → 回傳該 user 的所有收藏地點（新到舊）
 *   POST  body = JSON 物件         → 新增一筆收藏地點
 *
 * 回應一律 JSON：
 *   成功  { "success": true,  "data": ... }
 *   失敗  { "success": false, "message": "說明" }
 *   （GAS 沒有真的 HTTP status code，用 success 欄位表示）
 */

const SHEET_NAME = 'Places';
const SPREADSHEET_ID = ''; // 留空 = 用「附加在這張 Sheet 上」的試算表
const HEADERS = [
  'id',
  'userId',
  'storeName',
  'region',
  'category',
  'source',
  'imageUrl',
  'createdAt',
  'visited',
];
const IMAGE_MAX_LEN = 45000; // Google Sheets 單一儲存格上限約 50,000 字元

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

/** 取得 Places sheet；不存在就建立，並確保有標題列 */
function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
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

/* ─────────────── 讀取 ─────────────── */

function readAll_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.join('') === '') continue; // 跳過整列空白
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[String(header[c])] = row[c];
    }
    obj.id = String(obj.id);
    obj.userId = String(obj.userId);
    obj.visited =
      obj.visited === true || String(obj.visited).toLowerCase() === 'true';
    if (obj.createdAt instanceof Date) {
      obj.createdAt = obj.createdAt.toISOString();
    } else {
      obj.createdAt = obj.createdAt ? String(obj.createdAt) : '';
    }
    rows.push(obj);
  }
  return rows;
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

/* ─────────────── doPost：新增 ─────────────── */

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
      createdAt: new Date().toISOString(),
      visited: body.visited === true,
    };

    const sheet = getSheet_();
    const rowValues = HEADERS.map(function (h) {
      return record[h];
    });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000); // Sheets 並發寫入容易鎖住，加鎖保險
    try {
      sheet.appendRow(rowValues);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    return jsonOk_(record);
  } catch (err) {
    return jsonError_('寫入失敗：' + (err && err.message ? err.message : err));
  }
}
