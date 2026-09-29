import { useEffect, useState, type ReactNode } from 'react';
import WebNav from './WebNav';

/** 把 Date 格式化成狀態列要的 24 小時制「HH:MM」，不含秒數 */
function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * 狀態列的即時時鐘：進畫面先讀一次目前時間立刻顯示，
 * 接著對齊到下一個整分鐘邊界更新一次，之後才固定每 60 秒更新。
 *
 * 不能直接從掛載那一刻 setInterval(60_000)：計時器是從「掛載時間」開始算，
 * 跟真正的分鐘邊界對不齊，畫面上的數字要等最多 59 秒後才會跳，
 * 看起來就像時間固定慢了一截。所以先用 setTimeout 補上「掛載時間到下一個
 * 整分鐘」這段零頭，之後的 setInterval 才會準確落在整分鐘上，不會累積誤差。
 * 每次更新都重新 new Date() 讀系統當下時間，不用舊 Date 物件累加。
 */
function useClock(): string {
  const [time, setTime] = useState(() => formatClock(new Date()));

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const tick = () => setTime(formatClock(new Date()));

    const now = new Date();
    const msToNextMinute =
      60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());

    const timeoutId = setTimeout(() => {
      tick(); // 對齊到整分鐘邊界，先更新一次
      intervalId = setInterval(tick, 60_000); // 之後每 60 秒準時更新
    }, msToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, []);

  return time;
}

/**
 * 手機／平板寬度（<900px）：跟原本一樣，桌機時把 App 縮進手機外框（對照原型的 .phone），
 * 手機時直接鋪滿整個視窗（PWA 加到主畫面後的樣子）。
 *
 * 寬螢幕（≥900px，`wide:`）：不再縮成一支手機置中在畫面中間，改成撐滿寬度的真正網頁版面
 * （頂部換成 WebNav 導覽列，畫面本身也改用一般文件捲動），避免桌機瀏覽器開起來大片空白
 * （參考 lost-capybara 專案 index.html 的 @media (min-width:900px) 作法）。
 */
export default function PhoneFrame({
  children,
  showNav = true,
}: {
  children: ReactNode;
  showNav?: boolean;
}) {
  const time = useClock();

  return (
    <div className="flex min-h-full w-full justify-center bg-[#e7ddc4] sm:items-center sm:py-10 wide:block wide:bg-paper wide:py-0">
      <div
        className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-paper shadow-frame
                   sm:h-[min(812px,calc(100dvh-80px))] sm:w-[390px] sm:rounded-[44px] sm:border-[10px] sm:border-[#0f0d0b]
                   wide:h-auto wide:min-h-dvh wide:w-full wide:max-w-none wide:overflow-visible wide:rounded-none wide:border-0 wide:shadow-none"
      >
        {/* 狀態列（對照原型 .statusbar；時間是真的，電量／訊號是裝飾）。寬螢幕改用 WebNav，不顯示這條 */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-[env(safe-area-inset-top)] font-mono text-[12px] text-ink/80 wide:hidden">
          <span className="py-2">{time}</span>
          <span className="py-2">● ● ● 100%</span>
        </div>
        {showNav && <WebNav />}
        <div className="relative flex min-h-0 flex-1 flex-col wide:min-h-dvh">
          {children}
        </div>
      </div>
    </div>
  );
}
