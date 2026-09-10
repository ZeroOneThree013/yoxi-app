import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag } from './ui';

export default function HomeCard({
  tag,
  tagTone = 'teal',
  title,
  children,
  to,
  onClick,
  footer,
}: {
  tag: string;
  tagTone?: 'teal' | 'red' | 'mustard';
  title: string;
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  footer?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (onClick ? onClick() : to && navigate(to))}
      className="mb-4 block w-full overflow-hidden rounded-[20px] border border-line bg-card p-[18px] text-left active:scale-[0.98]"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <Tag tone={tagTone}>{tag}</Tag>
          <h3 className="mt-2 font-display text-[18px] font-semibold">{title}</h3>
        </div>
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-paper-deep text-[14px]">
          →
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted">{children}</p>
      {footer && <div className="mt-2.5 flex flex-wrap gap-1.5">{footer}</div>}
    </button>
  );
}
