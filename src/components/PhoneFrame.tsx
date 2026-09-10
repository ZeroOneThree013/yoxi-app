import type { ReactNode } from 'react';

/**
 * 桌機時把 App 放進手機外框（對照原型的 .phone），
 * 手機時直接鋪滿整個視窗（PWA 加到主畫面後的樣子）。
 */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full w-full justify-center bg-[#e7ddc4] sm:items-center sm:py-10">
      <div
        className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-paper shadow-frame
                   sm:h-[min(812px,calc(100dvh-80px))] sm:w-[390px] sm:rounded-[44px] sm:border-[10px] sm:border-[#0f0d0b]"
      >
        {/* 狀態列（純裝飾，對照原型 .statusbar） */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-[env(safe-area-inset-top)] font-mono text-[12px] text-ink/80">
          <span className="py-2">9:41</span>
          <span className="py-2">● ● ● 100%</span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
