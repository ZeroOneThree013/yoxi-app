# yoxi・AI 出行夥伴（PWA 假資料版）

依 `reference/yoxi-PRODUCT-SPEC.md` 第 6.2 節 Option B 搭建的前端骨架：

- **前端**：Vite + React（SPA）+ TypeScript，純靜態輸出
- **路由**：react-router（HashRouter，GitHub Pages 友善）
- **PWA**：vite-plugin-pwa（manifest + service worker，可加到主畫面）
- **樣式**：Tailwind CSS，色彩／字體照 spec 第 5 節設成 theme（`tailwind.config.js`）
- **地圖**：Leaflet + OpenStreetMap 圖磚 + OSRM demo（路線畫面），失敗時 fallback 直線
- **資料**：
  - **「想去的地方」已接後端**：Google Apps Script + Google Sheets（`src/lib/api.ts`、`gas/`）
  - 其餘功能仍是 mock（`src/data/mock.ts`）

> 後端網址還沒填時，「想去的地方」會自動退回本機 mock（重整會重置），畫面不會壞。
> 設定方式見 `gas/README.md` 與 `src/config.ts`。
> 其餘照 spec 第 4 節的表格逐項換：帳號系統 → 地圖／路徑規劃 → VLM/OCR → 叫車／訂位。

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產出 dist/（純靜態）
npm run preview  # 本機預覽 build 結果
```

## 畫面清單（對照 spec 第 2 節）

| 路由 | 畫面 | Spec |
|---|---|---|
| `/onboarding/1` | 基本資料（暱稱、常出沒城市） | 2.1 |
| `/onboarding/2` | 一週有空時段（星期、時段 chip） | 2.1 |
| `/onboarding/quiz`、`/quiz` | 十秒問答（心情／方向／出走指數）＝每日互動 | 2.1 / 2.2 |
| `/home` | 首頁 5 張入口卡片 | 2.2 |
| `/tasks` | 每日任務選單（徽章＋地圖點亮，無積分） | 2.3 |
| `/tasks/daily` | 任務一・今日推薦任務 | 2.3 |
| `/tasks/badges` | 任務二・節氣季節限定徽章牆 | 2.3 |
| `/places` | 想去的地方（車票式卡片 + FAB） | 2.4 |
| `/places/upload` | 上傳截圖 | 2.4 |
| `/places/upload/extract` | VLM 辨識結果（可編輯，不呈現 OCR 中間畫面） | 2.4 |
| `/plan` | 選擇任務地點（segment 切換、可複選） | 2.5 |
| `/route` | AI 規劃路線（真實地圖 + 統計 + 出發轉換分支） | 2.5 / 2.6 |
| `/confirm` | 叫車／訂位完成 + 任務獎勵（徽章＋點亮） | 2.6 / 2.8 |
| `/quick-ride` | 單純叫車（不觸發任務／徽章） | 2.7 |

畫面切換邏輯對照原型 `reference/yoxi-app-flow_3.html` 的行為。

## 狀態管理

`src/state/AppState.tsx`：`useReducer` + Context。

- `profile`／`quiz`／`dailyTask` 輕量寫入 `localStorage`（`yoxi.appstate.v1`），重整不掉。
- `places`（收藏地點）由後端提供：App 載入時 + 進「想去的地方」頁時各抓一次
  （`refreshPlaces()`），有 loading／空清單／錯誤三種狀態；不寫 `localStorage`。
- 流程暫存（勾選的地點、規劃路線、確認頁）不持久化。

## 後端串接（想去的地方）

- API 層：`src/lib/api.ts`（`fetchPlaces` / `createPlace`）
- 設定：`src/config.ts` 的 `API_BASE_URL`（或環境變數 `VITE_API_BASE_URL`）
- 後端程式與部署步驟：`gas/Code.gs`、`gas/README.md`
- Google Sheets 分頁 `Places`，欄位：`id / userId / storeName / region / category / source / imageUrl / createdAt / visited`
- POST 用 `Content-Type: text/plain` 避開 CORS preflight（spec 6.2）

## 部署到 GitHub Pages

`vite.config.ts` 用 `base: './'`（相對路徑），搭配 HashRouter，不用綁死 repo 名稱。
`.github/workflows/deploy.yml` 會在 push 到 `main` 時自動 build 並發佈到 Pages
（記得在 repo Settings → Pages → Source 選 **GitHub Actions**）。
