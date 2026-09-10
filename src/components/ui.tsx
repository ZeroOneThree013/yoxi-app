import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

/* ─────────── 版面 ─────────── */

export function ScreenScroll({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`no-scrollbar flex-1 overflow-y-auto px-5 pb-24 pt-1 ${className}`}
    >
      {children}
    </div>
  );
}

/** 底部固定的行動區（對照原型每個畫面底部的 padding 區塊） */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 space-y-2.5 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
      {children}
    </div>
  );
}

export function TopBar({
  title,
  back,
}: {
  title?: string;
  back?: string | number;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex shrink-0 items-center gap-2.5 px-5 pb-1 pt-4">
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
        <h2 className="font-display text-[19px] font-semibold">{title}</h2>
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
