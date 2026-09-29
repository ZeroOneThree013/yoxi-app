/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 桌機／寬螢幕斷點：≥900px 時從「手機外框置中」切換成真正撐滿寬度的網頁版面
      // （參考 lost-capybara 專案的 @media (min-width:900px) 作法）
      screens: {
        wide: '900px',
      },
      colors: {
        // 仿舊車票紙質感（spec §5）
        ink: '#211C16',
        paper: '#F1E7CD',
        'paper-deep': '#E3D4AC',
        card: '#FFFAF0',
        red: '#FF210C',
        'red-deep': '#C11207',
        teal: '#0E5C53',
        'teal-soft': '#DCEAE6',
        mustard: '#D89A2C',
        line: 'rgba(33,28,22,0.16)',
        muted: '#7A7267',
      },
      fontFamily: {
        // 標題／品牌感
        display: ['Fraunces', 'Georgia', 'serif'],
        // 內文
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        // 只用在真正的數字：公里、金額、時間、徽章數（spec §5）
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        frame: '0 18px 40px -20px rgba(33,28,22,0.35)',
        card: '0 2px 6px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        ticket: '14px 4px 4px 14px',
      },
    },
  },
  plugins: [],
};
