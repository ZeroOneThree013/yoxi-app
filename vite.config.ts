import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// 相對 base：部署到 GitHub Pages 專案頁（/<repo>/）時不用綁死 repo 名稱，
// 搭配 HashRouter 一起用最保險。本機 dev 不受影響。
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 關掉自動注入的註冊 script，改在 src/main.tsx 自己呼叫 registerSW()，
      // 才能加「定期檢查更新」的邏輯（見 main.tsx 的說明）。
      injectRegister: null,
      includeAssets: ['apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'yoxi・AI 出行夥伴',
        short_name: 'yoxi',
        description: '不只是叫車，是平常就在用的 AI 出行夥伴',
        theme_color: '#FF210C',
        background_color: '#F1E7CD',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
});
