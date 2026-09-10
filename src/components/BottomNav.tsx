import { NavLink } from 'react-router-dom';

const items = [
  { to: '/home', icon: '⌂', label: '首頁' },
  { to: '/tasks', icon: '✓', label: '每日任務' },
  { to: '/places', icon: '📍', label: '想去的地方' },
];

export default function BottomNav() {
  return (
    <nav className="relative z-30 flex h-16 shrink-0 items-center justify-around border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-bold ${
              isActive ? 'text-red' : 'text-[#B3AB9E]'
            }`
          }
        >
          <span className="text-[18px]">{it.icon}</span>
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
