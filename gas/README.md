# 「想去的地方」後端部署（Google Apps Script + Google Sheets）

`Code.gs` 的內容自己貼到 Apps Script 編輯器手動部署。以下是步驟。

> 已經部署過的人：`Code.gs` 這次新增了「截圖辨識」功能（呼叫 Gemini API），
> 辨識結果現在也會**順便估算地點座標**存進 `lat` / `lng`，新增地點時後端還會
> 額外查一次 **Nominatim 地理編碼**修正座標（見第 7 節）——不用另外申請金鑰，
> Nominatim 是免費、不用註冊的服務。
> 把新版內容貼回 Apps Script 編輯器覆蓋舊的 `Code.gs`，做第 3 節設定 Gemini 金鑰，
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
- **座標**：辨識一個知名地點（例如連鎖咖啡店、知名景點）並儲存後，
  去 Google Sheet 的 `Places` 分頁看那一列的 `lat` / `lng`，應該有數字（不是空的）；
  辨識不出具體地點的截圖，這兩欄留空是正常的。
- **精確查詢有沒有生效**：同一列的 `coordSource` 欄位——`geocoded` 表示這筆座標是
  Nominatim 精確查到的，`estimated` 是退回 Gemini 估算，空字串是兩個都沒查到。
  也可以到 Apps Script 編輯器左側 **執行項目 (Executions)** 看最近一次 `doPost` 的
  執行紀錄（Logs），會有 `Nominatim 查到座標...` 或 `Nominatim 查無結果...` 的訊息。

## 6. 關於 Gemini 截圖辨識與額度

- 用的是 Google AI Studio 申請的**免費額度**金鑰，多模態模型（目前是 `gemini-3.6-flash`，
  設定在 `Code.gs` 的 `GEMINI_MODEL` 常數，之後模型停用要換名稱改這裡就好）。
- 免費額度有**請求次數限制**（每分鐘 / 每天）。如果辨識開始常常失敗、
  或看到「Gemini API 額度已用完或請求過於頻繁（HTTP 429）」，
  去 [Google AI Studio](https://aistudio.google.com/app/apikey) 或
  Google Cloud Console 的用量頁面確認額度用完了沒。
- 免費層偶爾會回 **503**（暫時性過載）：後端遇到 503 或連線逾時會自動重試
  （等 0.6s、再等 1.5s，共嘗試 3 次），成功就直接回結果，不用你手動重刷；
  都失敗才回錯誤（訊息會附上「已重試 2 次」）。重試延遲設定在 `Code.gs` 的
  `RECOGNIZE_RETRY_DELAYS_MS`。
- 辨識失敗（額度用完、重試 3 次都 503、Gemini 抽風回不出乾淨 JSON、圖片太大等）一律回
  `{"success":false, "message":"..."}`，前端會讓欄位留白給使用者手動填寫，
  **不會卡住整個上傳流程**——這是設計上的 fallback，不是要修的 bug。
- 送出去的截圖前端已經先壓縮（最長邊 ≤ 1280px），後端也有一層大小防呆
  （`RECOGNIZE_IMAGE_MAX_LEN`），避免 GAS 執行時間或 Gemini 請求大小限制炸掉。

## 7. 關於 lat / lng 欄位：Nominatim 精確查詢 + Gemini 估算

新增地點時，`handleCreatePlace_` 依序決定座標：

1. **Nominatim 地理編碼查詢（精確）**：用「店名 + 地區」查
   [Nominatim](https://nominatim.openstreetmap.org/)（OpenStreetMap 的免費地理編碼服務），
   查到就用這組座標，**覆蓋掉**下一項的 Gemini 估算值。
2. **Gemini 估算（大概）**：截圖辨識時 Gemini 依世界知識估算的座標，前端存檔時背景帶過去
   （使用者看不到、不用編輯）。只有 Nominatim 查無結果時才會用這組。
3. **都沒有**：兩個都沒查到 / 沒估算出來，`lat` / `lng` 留空，`doGet` 讀出來是 `null`。

哪一筆是精確查詢、哪一筆是估算，存在 `coordSource` 欄位（`geocoded` / `estimated` / 空字串），
**這是內部除錯用的註記，不給使用者看**，也不會出現在任何畫面上。

### 為什麼地理編碼放在後端（GAS），不是前端直接呼叫 Nominatim

Nominatim 的使用規範要求請求要帶一個**有意義的 `User-Agent` header**識別應用程式。
瀏覽器的 `fetch`/`XHR` 把 `User-Agent` 列為 forbidden header——前端 JS 沒辦法自訂這個值，
瀏覽器一律送出自己的 UA 字串，沒辦法真的符合這條規範。GAS 的 `UrlFetchApp` 可以自訂任意
header，所以地理編碼查詢刻意放在後端做（`geocodePlace_`），才能真的照規範帶上
`User-Agent: yoxi-app/1.0 (hackathon demo; ...)`。

其他使用規範重點：
- **最多每秒 1 次請求**：目前只有使用者按「儲存到想去的地方」時查一次，用量很小，
  沒特別做速率限制；`Code.gs` 的 `NOMINATIM_URL` 常數旁邊有註解標記這件事，
  以後如果要做批次 / 高流量查詢，要在 `geocodePlace_` 加節流。
- **逾時**：GAS 的 `UrlFetchApp` 沒有可設定的逾時參數（Apps Script 本身的限制），
  沒辦法保證嚴格幾秒內一定回來——這裡只做失敗防呆（try/catch + 檢查回應／結果），
  查詢失敗或找不到都直接回 `null`，不會卡住存檔流程；前端 `createPlace()` 的逾時
  已拉長到 20 秒給這個多出來的查詢留緩衝。

### 準確度

- **精確查詢（`geocoded`）**：Nominatim 找到的是真實地址對應的座標，準確度看店名／地區
  文字有多完整、Nominatim 資料庫有沒有收錄這個地點。
- **估算（`estimated`）**：Gemini 依世界知識用「大概位置」，可能誤差到幾百公尺甚至抓到
  馬路對面——知名地標（連鎖店、觀光景點）通常比較準，小眾 / 新開的店家誤差可能較大。
- 路線規劃畫面（`src/lib/route.ts` 的 `placeCoord`）會優先用地點自己的 `lat` / `lng`；
  真的沒有實值時才 fallback 回原型的假座標，地圖不會因此空白或壞掉。

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
| 辨識一直回「Gemini API 額度已用完...（HTTP 429）」 | 免費額度用完或太頻繁，去 AI Studio 確認額度，或稍後再試（429 不會自動重試，重刷沒用要等） |
| 辨識回「Gemini API 回應異常（已重試 2 次）（HTTP 503）」 | 免費層過載，連重試 3 次都沒排到；通常是短暫的，晚一點再上傳一次同一張截圖即可 |
| 辨識一直回「辨識失敗，請手動填寫」 | 通常是 Gemini 沒回乾淨 JSON（已有防呆解析仍失敗），或圖片內容真的看不出地點；手動填寫即可，不影響儲存 |
| 改了 `Code.gs` 但辨識行為沒變 | 忘記重新部署，見第 8 節「Manage deployments → New version」 |
| 存的地點 `coordSource` 一直是 `estimated` 或空字串，沒有 `geocoded` | 正常情況：Nominatim 查無結果就會這樣。可以查 Executions 的 log 看是「查無結果」還是「查詢失敗」；店名 + 地區文字太模糊、或地點根本沒被 OSM 收錄都會查不到 |
| 存新地點變得比較慢 | 預期中的，因為多打一次 Nominatim；GAS 沒有逾時控制，查詢失敗一樣會 fallback，不會卡死，只是這次請求會多等一下 |
