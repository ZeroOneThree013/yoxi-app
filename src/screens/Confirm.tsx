import { Navigate, useNavigate } from 'react-router-dom';
import { BottomBar, Button, ScreenScroll } from '../components/ui';
import { useApp } from '../state/AppState';

export default function Confirm() {
  const navigate = useNavigate();
  const { confirmation, dispatch } = useApp();

  if (!confirmation) return <Navigate to="/home" replace />;

  const { kind, title, context, reward, badge, litArea } = confirmation;
  const isDining = kind === 'dining';

  const home = () => {
    dispatch({ type: 'clearSelected' });
    navigate('/home');
  };

  return (
    <>
      <ScreenScroll>
        <div className="px-2.5 pb-5 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-[74px] w-[74px] items-center justify-center rounded-full bg-red text-[30px] text-white">
            ✓
          </div>
          <h3 className="mb-1.5 font-display text-[20px]">{title}</h3>
          <p className="text-[13px] text-muted">{context}</p>
        </div>

        <div className="my-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
          <div
            className={`h-11 w-11 shrink-0 rounded-full ${
              isDining ? 'bg-teal' : 'bg-ink'
            }`}
          />
          <div>
            <h4 className="mb-0.5 text-[14px] font-bold">
              {isDining
                ? '合作餐廳・山海咖啡食堂'
                : '陳司機 · 白色 Toyota Altis'}
            </h4>
            <div className="text-[11.5px] text-[#9A9184]">
              {isDining
                ? '已為你保留座位 · 19:30 到店即可入座'
                : '車牌 ABC-1234 · 約 4 分鐘後抵達'}
            </div>
          </div>
        </div>

        {reward && badge && (
          <div className="rounded-2xl border border-line bg-card p-[15px]">
            <h4 className="mb-2.5 font-display text-[14.5px] font-semibold">
              任務獎勵
            </h4>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-mustard text-[24px] text-white">
                {badge.icon}
              </div>
              <div>
                <div className="font-display text-[14.5px] font-semibold">
                  {badge.name}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted">
                  {badge.note}
                </div>
              </div>
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted">
              地圖上的{litArea ?? '這個角落'}已經亮起，累積造訪的城市角落越來越多了！集滿節氣／季節限定條件還能解鎖專屬徽章。
            </p>
          </div>
        )}
      </ScreenScroll>
      <BottomBar>
        <Button variant="ghost" onClick={home}>
          回到首頁
        </Button>
      </BottomBar>
    </>
  );
}
