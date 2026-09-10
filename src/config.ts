/**
 * 後端設定。
 * 目前只有「想去的地方」接了 Google Apps Script + Google Sheets，
 * 其餘功能仍是 mock（見 src/data/mock.ts）。
 */

// ┌───────────────────────────────────────────────────────────────────┐
// │ TODO: 部署 Apps Script Web App 後，把拿到的網址貼在這裡（要 /exec 結尾） │
// │  例：https://script.google.com/macros/s/AKfycb..................../exec │
// │  部署步驟見 gas/README.md                                            │
// └───────────────────────────────────────────────────────────────────┘
const DEPLOYED_API_URL = '';

// 也可用環境變數覆蓋（專案根目錄建 .env.local，寫 VITE_API_BASE_URL=...）
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEPLOYED_API_URL
).trim();

/**
 * 先寫死的假 session id，對應 Places sheet 的 userId 欄位。
 * 之後接帳號系統再換成真實使用者 id。
 */
export const DEMO_USER_ID = 'demo-user';
