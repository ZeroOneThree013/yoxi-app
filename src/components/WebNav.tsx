import { NavLink } from 'react-router-dom';
import yoxiLogo from '../assets/yoxi-logo.png';

const items = [
  { to: '/home', label: '首頁' },
  { to: '/tasks', label: '每日任務' },
  { to: '/places', label: '想去的地方' },
  { to: '/quick-ride', label: '單純叫車' },
];

/**
 * 桌機／寬螢幕版的頂部導覽列，取代手機版的 BottomNav（≥900px，對照原型的 .topbar）。
 * 手機與平板寬度（<900px）完全不渲染，讓 PhoneFrame 維持原本的手機外框樣式。
 */
export default function WebNav() {
  return (
    <header className="sticky top-0 z-30 hidden w-full items-center gap-8 border-b-2 border-line bg-paper-deep/90 px-10 py-3.5 backdrop-blur wide:flex">
      <div className="flex items-center gap-2.5">
        <img
          src={yoxiLogo}
          alt="yoxi"
          className="h-8 w-8 rounded-lg object-contain"
        />
        <span className="font-display text-[19px] font-semibold">yoxi</span>
      </div>
      <nav className="flex items-center gap-1.5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors ${
                isActive ? 'bg-red text-white' : 'text-muted hover:bg-card'
              }`
            }
          >
            {it.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
