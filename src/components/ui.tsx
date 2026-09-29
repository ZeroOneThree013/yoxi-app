import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import yoxiLogo from '../assets/yoxi-logo.png';

/* ─────────── 版面 ─────────── */

/**
 * 寬螢幕（≥900px）版面寬度：
 * - grid：清單／卡片類畫面（首頁、任務、想去的地方…），撐滿寬版讓多欄 grid 有地方放
 * - split：表單類畫面（Onboarding、Quiz、上傳、叫車…），中等寬度，搭配 WideAside 兩欄並排
 * - narrow：確認類畫面，維持置中窄卡片，不硬塞內容撐版面
 */
type WideLayout = 'grid' | 'split' | 'narrow';

const WIDE_MAX_W: Record<WideLayout, string> = {
  grid: 'wide:max-w-[1180px]',
  split: 'wide:max-w-[900px]',
  narrow: 'wide:max-w-[560px]',
};

export function ScreenScroll({
  children,
  className = '',
  wide = 'grid',
}: {
  children: ReactNode;
  className?: string;
  wide?: WideLayout;
}) {
  return (
    <div
      className={`no-scrollbar flex-1 overflow-y-auto px-5 pb-24 pt-1
        wide:mx-auto wide:w-full wide:flex-none wide:overflow-visible wide:px-10 wide:pb-16 wide:pt-8
        ${WIDE_MAX_W[wide]} ${className}`}
    >
      {children}
    </div>
  );
}

/** 底部固定的行動區（對照原型每個畫面底部的 padding 區塊） */
export function BottomBar({
  children,
  wide = 'grid',
}: {
  children: ReactNode;
  wide?: WideLayout;
}) {
  return (
    <div
      className={`shrink-0 space-y-2.5 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3
        wide:mx-auto wide:w-full wide:px-10 wide:pb-14 wide:pt-0
        ${WIDE_MAX_W[wide]}`}
    >
      {children}
    </div>
  );
}

export function TopBar({
  title,
  back,
  wide = 'grid',
}: {
  title?: string;
  back?: string | number;
  wide?: WideLayout;
}) {
  const navigate = useNavigate();
  return (
    <div
      className={`flex shrink-0 items-center gap-2.5 px-5 pb-1 pt-4
        wide:mx-auto wide:w-full wide:px-10 wide:pt-9
        ${WIDE_MAX_W[wide]}`}
    >
      {back !== undefined && (
        <button
          type="button"
          aria-label="返回"
          onClick={() => {
            if (typeof back === 'number') navigate(back);
            else navigate(back);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card text-[15px] active:scale-95"
        >
          ←
        </button>
      )}
      {title && (
        <h2 className="font-display text-[19px] font-semibold wide:text-[26px]">
          {title}
        </h2>
      )}
    </div>
  );
}

/**
 * 寬螢幕表單類畫面（split 版面）搭配的裝飾側欄：放大版 logo + 標語，
 * 呼應 lost-capybara 偏好表單旁的角色插圖，避免窄表單在寬螢幕上左右大片空白。
 * <900px 完全不渲染。
 */
export function WideAside({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="hidden wide:flex wide:h-full wide:flex-col wide:items-center wide:justify-center wide:gap-5 wide:rounded-[32px] wide:border wide:border-line wide:bg-card wide:p-10 wide:text-center wide:shadow-card">
      <img
        src={yoxiLogo}
        alt=""
        className="h-20 w-20 rounded-2xl object-contain shadow-[0_6px_16px_-6px_rgba(255,33,12,0.55)]"
      />
      <h3 className="font-display text-[20px] font-semibold">{title}</h3>
      {note && (
        <p className="max-w-[240px] text-[13px] leading-relaxed text-muted">
          {note}
        </p>
      )}
    </div>
  );
}

/* ─────────── 元件 ─────────── */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'teal';
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: BtnProps) {
  const styles = {
    primary: 'bg-red text-white active:bg-red-deep',
    ghost: 'bg-card text-ink border border-line',
    teal: 'bg-teal text-white',
  }[variant];
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3.5
                  text-[14.5px] font-bold disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    />
  );
}

export function Chip({
  selected,
  children,
  onClick,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`select-none rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors
        ${
          selected
            ? 'border-ink bg-ink text-white'
            : 'border-line bg-card text-ink'
        }`}
    >
      {children}
    </button>
  );
}

type TagTone = 'teal' | 'red' | 'mustard';

export function Tag({
  tone = 'teal',
  children,
}: {
  tone?: TagTone;
  children: ReactNode;
}) {
  const styles = {
    teal: 'bg-teal-soft text-teal',
    red: 'bg-[#F9DED5] text-red-deep',
    mustard: 'bg-[#F5E6C8] text-[#8C6410]',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-wide ${styles}`}
    >
      {children}
    </span>
  );
}

/** 統計數字用等寬字（比照車票序號質感，spec §5） */
export function StatPill({
  children,
  tone = 'teal',
}: {
  children: ReactNode;
  tone?: 'teal' | 'mustard';
}) {
  const styles =
    tone === 'mustard'
      ? 'bg-[#F5E6C8] text-[#8C6410]'
      : 'bg-teal-soft text-teal';
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold ${styles}`}
    >
      {children}
    </span>
  );
}

export function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="mb-5 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1 rounded ${i < step ? 'bg-red' : 'bg-line'}`}
          style={{ width: 22 }}
        />
      ))}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-[18px]">
      <label className="mb-1.5 block text-[12px] font-bold text-[#8A8175]">
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[14.5px] text-ink outline-none focus:border-red"
    />
  );
}

export function RuleCard({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 rounded-2xl border border-line bg-card p-[15px] ${className}`}
    >
      {title && (
        <h4 className="mb-1.5 font-display text-[14.5px] font-semibold">
          {title}
        </h4>
      )}
      <div className="text-[12.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}
