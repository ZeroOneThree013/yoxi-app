import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import PhoneFrame from './components/PhoneFrame';
import { useApp } from './state/AppState';

export default function App() {
  const { profile } = useApp();
  const location = useLocation();
  const path = location.pathname;

  // 手機版每個畫面本來就是獨立的捲動容器，換頁自然回到頂端；
  // 但寬螢幕版改成捲動整個文件（見 PhoneFrame／ScreenScroll 的 wide: 版面），
  // 換頁後需要自己把捲動位置歸零，否則會保留上一頁捲到一半的位置。
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  const inOnboarding = path.startsWith('/onboarding');

  // 還沒完成 onboarding 時，任何頁面都導回 onboarding 第一步（對照原型：一開始就在 s-onb1）
  if (!profile.onboarded && !inOnboarding) {
    return <Navigate to="/onboarding/1" replace />;
  }
  // 已完成 onboarding 又回到 onboarding 路徑時，導回首頁
  if (profile.onboarded && inOnboarding) {
    return <Navigate to="/home" replace />;
  }

  return (
    <PhoneFrame showNav={!inOnboarding}>
      {/* key 讓每次換頁重播進場動畫（對照原型 .screen 切換） */}
      <div key={path} className="screen-enter flex h-full flex-col wide:block wide:h-auto">
        <Outlet />
      </div>
    </PhoneFrame>
  );
}
