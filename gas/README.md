# 「想去的地方」後端部署（Google Apps Script + Google Sheets）

`Code.gs` 的內容自己貼到 Apps Script 編輯器手動部署。以下是步驟。

## 1. 建立試算表與腳本

1. 到 Google Drive 新增一個 **Google Sheet**（名字隨意，例如 `yoxi-db`）。
   - **不用**手動建 `Places` 分頁，第一次寫入時腳本會自動建立並補上標題列。
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

## 3. 把網址貼進前端

打開 `src/config.ts`，貼到 `DEPLOYED_API_URL`：

```ts
const DEPLOYED_API_URL = 'https://script.google.com/macros/s/AKfycb....../exec';
```

（或在專案根目錄建 `.env.local` 寫 `VITE_API_BASE_URL=https://.../exec`，會覆蓋 config.ts。）

然後：
- 本機測：`npm run dev`
- 上線：commit + push，GitHub Pages 會自動重新部署

## 4. 快速驗證

- **讀**：瀏覽器直接開 `你的網址?userId=demo-user`
  應回傳 `{"success":true,"data":[]}`（還沒資料時是空陣列）。
- **寫**：在 App 裡走「想去的地方 → ＋ → 上傳截圖 → 開始 AI 辨識 → 儲存」，
  回到清單看得到新項目，且 Google Sheet 的 `Places` 分頁多一列。

## 5. 之後改 Code.gs 怎麼重新部署

**Deploy → Manage deployments → 選現有的那個 → 鉛筆(編輯) → Version 選「New version」→ Deploy。**
這樣網址不變，不用再改前端。（若選 New deployment 會產生新網址，要再貼一次。）

## 疑難排解

| 症狀 | 原因 / 解法 |
|---|---|
| 前端顯示「後端回傳的不是合法 JSON」 | Web app URL 沒用 `/exec` 結尾，或 Who has access 不是 Anyone，或部署沒更新到最新版本 |
| `{"success":false,"message":"抓不到試算表..."}` | 腳本不是從 Sheet 的 Extensions 建立的 → 填 `SPREADSHEET_ID`，或重新從 Sheet 建腳本 |
| `缺少必要欄位：userId` | 正常的錯誤訊息（直接開 `/exec` 沒帶 `?userId=` 就會這樣） |
| 寫入成功但清單沒更新 | 前端會在回到清單時重新抓；若還是沒有，確認 Sheet 有多一列、`userId` 欄是 `demo-user` |
