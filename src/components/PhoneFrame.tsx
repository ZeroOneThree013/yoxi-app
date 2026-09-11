import { useEffect, useState, type ReactNode } from 'react';

/** 把 Date 格式化成狀態列要的 24 小時制「HH:MM」，不含秒數 */
function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 狀態列的即時時鐘：進畫面先讀一次目前時間，之後每分鐘更新一次 */
function useClock(): string {
  const [time, setTime] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatClock(new Date()));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  return time;
}

/**
 * 桌機時把 App 放進手機外框（對照原型的 .phone），
 * 手機時直接鋪滿整個視窗（PWA 加到主畫面後的樣子）。
 */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  const time = useClock();

  return (
    <div className="flex min-h-full w-full justify-center bg-[#e7ddc4] sm:items-center sm:py-10">
      <div
        className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-paper shadow-frame
                   sm:h-[min(812px,calc(100dvh-80px))] sm:w-[390px] sm:rounded-[44px] sm:border-[10px] sm:border-[#0f0d0b]"
      >
        {/* 狀態列（對照原型 .statusbar；時間是真的，電量／訊號是裝飾） */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-[env(safe-area-inset-top)] font-mono text-[12px] text-ink/80">
          <span className="py-2">{time}</span>
          <span className="py-2">● ● ● 100%</span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
