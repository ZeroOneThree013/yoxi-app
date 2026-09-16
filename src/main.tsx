import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { router } from './router';
import { AppStateProvider } from './state/AppState';

// registerType: 'autoUpdate'（vite.config.ts）找到新版就直接套用＋重整，不用
// 使用者按確認；但瀏覽器自己檢查「有沒有新版」的頻率不夠積極，常常改完部署後
// 開著的分頁還在跑舊版。這裡每 60 秒主動戳一次 registration.update()，
// 縮短「部署了新版但畫面還是舊的」這個時間差。
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      void registration.update();
    }, 60_000);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <RouterProvider router={router} />
    </AppStateProvider>
  </StrictMode>,
);
