# 「想去的地方」後端部署（Google Apps Script + Google Sheets）

`Code.gs` 的內容自己貼到 Apps Script 編輯器手動部署。以下是步驟。

> 已經部署過的人：`Code.gs` 這次新增了「截圖辨識」功能（呼叫 Gemini API）。
> 把新版內容貼回 Apps Script 編輯器覆蓋舊的 `Code.gs`，做第 3 節設定 API 金鑰，
> 再照第 8 節「Manage deployments → New version → Deploy」重新部署（網址不變，
> 前端 `src/config.ts` 不用改）。

## 1. 建立試算表與腳本

1. 到 Google Drive 新增一個 **Google Sheet**（名字隨意，例如 `yoxi-db`）。
   - **不用**手動建 `Places` 分頁，第一次讀 / 寫時腳本會自動建立並補上標題列。
   - 標題列欄位：
     `id / userId / storeName / region / category / source / imageUrl / lat / lng / createdAt / visited`
   - 如果你之前已經用舊版（沒有 `lat` / `lng`）建過 `Places`，**不用手動改**：
     腳本第一次執行時偵測到缺欄位，會自動把 `lat` / `lng` 補到標題列尾端，
     舊資料列這兩欄留空，不會噴錯。
2. 在這張 Sheet 裡：**擴充功能 (Extensions) → Apps Script**。
   > 一定要從 Sheet 裡開，腳本才會「附加」在這張試算表上，
   > `SpreadsheetApp.getActiveSpreadsheet()` 才抓得到。
   > （如果你已經有獨立腳本，改成在 `Code.gs` 最上面的 `SPREADSHEET_ID` 填入試算表 ID。）
3. 把編輯器裡預設的 `function myFunction() {}` 全部刪掉，貼上 `gas/Code.gs` 的完整內容。
4. `Ctrl/Cmd + S` 存檔，左上專案名稱改成 `yoxi-places-api` 之類。

## 2. 部署成 Web App

1. 右上角 **Deploy → New deployment**。
2. 齒輪圖示 **Select type → Web app**。
3. 設定：
   | 欄位 | 選什麼 | 原因 |
   |---|---|---|
   | Description | 隨意（例：`v1`） | |
   | **Execute as** | **Me（你的 Google 帳號）** | 腳本才有權限寫你的試算表 |
   | **Who has access** | **Anyone** | 前端是匿名呼叫，沒有登入。<br>注意：任何知道網址的人都能讀寫這張 sheet，展示階段可接受，正式上線要換掉這層。 |
4. **Deploy** → 跳出授權：
   - 選你的 Google 帳號
   - 「Google 尚未驗證這個應用程式」→ **Advanced（進階）→ Go to yoxi-places-api (unsafe)**
   - **Allow（允許）**
5. 複製 **Web app URL**，長這樣：
   ```
   https://script.google.com/macros/s/AKfycb**************************/exec
   ```

## 3. 設定 Gemini API 金鑰（截圖辨識用）

「上傳截圖 → 開始 AI 辨識」呼叫的是 Google Gemini API（多模態），金鑰**不寫在程式碼裡**，
存在 Apps Script 的「指令碼屬性 (Script Properties)」。

1. 申請金鑰：開 **[Google AI Studio](https://aistudio.google.com/apikey)** → 用你的 Google
   帳號登入 → **Create API key**（免費額度，有請求次數限制，見下方「關於 Gemini 額度」）。
2. 回到 Apps Script 編輯器（跟 `Code.gs` 同一個專案）：
   左側齒輪圖示 **專案設定 (Project Settings)**。
3. 往下捲到 **指令碼屬性 (Script Properties)** → **新增指令碼屬性 (Add script property)**：
   - **屬性 (Property)**：`GEMINI_API_KEY`
   - **值 (Value)**：貼上剛剛申請的金鑰
   - **儲存指令碼屬性 (Save script properties)**
4. 不用重新部署——`Code.gs` 是用
   `PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')`
   即時讀取，存好屬性就生效。

沒設定這個屬性時，辨識請求會回
`{"success":false,"message":"後端尚未設定 GEMINI_API_KEY..."}`，
前端會顯示「請直接手動填寫下方欄位」，不會卡住整個上傳流程。

## 4. 把網址貼進前端

打開 `src/config.ts`，貼到 `DEPLOYED_API_URL`：

```ts
const DEPLOYED_API_URL = 'https://script.google.com/macros/s/AKfycb....../exec';
```

（或在專案根目錄建 `.env.local` 寫 `VITE_API_BASE_URL=https://.../exec`，會覆蓋 config.ts。）

然後：
- 本機測：`npm run dev`
- 上線：commit + push，GitHub Pages 會自動重新部署

## 5. 快速驗證

- **讀**：瀏覽器直接開 `你的網址?userId=demo-user`
  應回傳 `{"success":true,"data":[]}`（還沒資料時是空陣列）。
- **寫**：在 App 裡走「想去的地方 → ＋ → 上傳截圖 → 開始 AI 辨識 → 儲存」，
  回到清單看得到新項目，且 Google Sheet 的 `Places` 分頁多一列。
- **辨識**：走到「開始 AI 辨識」那步，應該幾秒內回真的辨識結果（不是固定的示範資料）；
  改變截圖內容，辨識出的店名／地區/種類也應該跟著變。

## 6. 關於 Gemini 截圖辨識與額度

- 用的是 Google AI Studio 申請的**免費額度**金鑰，多模態模型（目前是 `gemini-2.0-flash`，
  設定在 `Code.gs` 的 `GEMINI_MODEL` 常數，之後模型停用要換名稱改這裡就好）。
- 免費額度有**請求次數限制**（每分鐘 / 每天）。如果辨識開始常常失敗、
  或看到「Gemini API 額度已用完或請求過於頻繁（HTTP 429）」，
  去 [Google AI Studio](https://aistudio.google.com/app/apikey) 或
  Google Cloud Console 的用量頁面確認額度用完了沒。
- 辨識失敗（額度用完、Gemini 抽風回不出乾淨 JSON、圖片太大等）一律回
  `{"success":false, "message":"..."}`，前端會讓欄位留白給使用者手動填寫，
  **不會卡住整個上傳流程**——這是設計上的 fallback，不是要修的 bug。
- 送出去的截圖前端已經先壓縮（最長邊 ≤ 1280px），後端也有一層大小防呆
  （`RECOGNIZE_IMAGE_MAX_LEN`），避免 GAS 執行時間或 Gemini 請求大小限制炸掉。

## 7. 關於 lat / lng 欄位

`lat` / `lng` 目前是**預留欄位**：

- 前端這次**不會**送座標值（還沒有座標來源）。
- 後端收到沒帶 `lat` / `lng` 就存成空儲存格；`doGet` 讀出來會是 `null`。
- 實際的座標值要等之後接這類功能才會真的填入：
  - 「截圖辨識（VLM）時順便取得座標」，或
  - 「依 `region` 地區文字做地理編碼（geocoding）」
- 在那之前，`Places` 分頁裡新增的地點 `lat` / `lng` 一律是空的；
  前端路線規劃畫面的地點座標暫時仍沿用原型假資料（見 `src/lib/route.ts` 的 `placeCoord`）。

## 8. 之後改 Code.gs 怎麼重新部署

**Deploy → Manage deployments → 選現有的那個 → 鉛筆(編輯) → Version 選「New version」→ Deploy。**
這樣網址不變，不用再改前端。（若選 New deployment 會產生新網址，要再貼一次。）

## 疑難排解

| 症狀 | 原因 / 解法 |
|---|---|
| 前端顯示「後端回傳的不是合法 JSON」 | Web app URL 沒用 `/exec` 結尾，或 Who has access 不是 Anyone，或部署沒更新到最新版本 |
| `{"success":false,"message":"抓不到試算表..."}` | 腳本不是從 Sheet 的 Extensions 建立的 → 填 `SPREADSHEET_ID`，或重新從 Sheet 建腳本 |
| `缺少必要欄位：userId` | 正常的錯誤訊息（直接開 `/exec` 沒帶 `?userId=` 就會這樣） |
| 寫入成功但清單沒更新 | 前端會在回到清單時重新抓；若還是沒有，確認 Sheet 有多一列、`userId` 欄是 `demo-user` |
| 辨識一直回「後端尚未設定 GEMINI_API_KEY」 | 見第 3 節設定指令碼屬性；設定完不用重新部署，即時生效 |
| 辨識一直回「Gemini API 額度已用完...（HTTP 429）」 | 免費額度用完或太頻繁，去 AI Studio 確認額度，或稍後再試 |
| 辨識一直回「辨識失敗，請手動填寫」 | 通常是 Gemini 沒回乾淨 JSON（已有防呆解析仍失敗），或圖片內容真的看不出地點；手動填寫即可，不影響儲存 |
| 改了 `Code.gs` 但辨識行為沒變 | 忘記重新部署，見第 8 節「Manage deployments → New version」 |
