import { Navigate, useNavigate } from 'react-router-dom';
import RouteMap from '../components/RouteMap';
import { BottomBar, Button, ScreenScroll, TopBar } from '../components/ui';
import { useApp } from '../state/AppState';
import type { FinishType } from '../types';

export default function RouteScreen() {
  const navigate = useNavigate();
  const { route, places, dispatch } = useApp();

  if (!route) return <Navigate to="/plan" replace />;

  const { stops, totalDist, totalTime, totalCost } = route;
  const order = stops.map((s) => s.name).join(' → ');

  const finish = (type: FinishType) => {
    const first = stops[0];
    const seasonalPlace = stops
      .map((s) => places.find((p) => p.id === s.placeId))
      .find((p) => p?.seasonal);

    dispatch({
      type: 'setConfirmation',
      confirmation: {
        kind: type,
        title: type === 'dining' ? '餐廳訂位完成！' : 'yoxi 已幫你叫車！',
        context:
          type === 'dining'
            ? `已為你保留合作餐廳座位，稍後可依路線繼續造訪：${
                stops.map((s) => s.name).join('、') || '收藏地點'
              }`
            : `前往：${stops.map((s) => s.name).join('、')}（共 ${totalDist} km）`,
        reward: true,
        badge: seasonalPlace?.seasonal
          ? {
              icon: seasonalPlace.seasonal.icon,
              name: `獲得徽章：${seasonalPlace.seasonal.name}`,
              note: '節氣・季節限定地點造訪成就',
            }
          : {
              icon: '🗺️',
              name: `獲得徽章：${first?.name ?? '這個地點'}探索者`,
              note: '探索足跡成就',
            },
        litArea: first ? first.meta.split(' · ')[1] ?? first.name : undefined,
      },
    });
    navigate('/confirm');
  };

  return (
    <>
      <TopBar title="AI 規劃路線" back="/plan" />
      <ScreenScroll>
        <RouteMap stops={stops} />

        <div className="mb-4 flex gap-2.5">
          {[
            [totalDist.toFixed(1), '總公里'],
            [String(totalTime), '分鐘車程'],
            [`$${totalCost}`, '預估車資'],
          ].map(([num, lab]) => (
            <div
              key={lab}
              className="flex-1 rounded-[14px] border border-line bg-card p-3 text-center"
            >
              <div className="font-mono text-[17px] font-bold">{num}</div>
              <div className="mt-0.5 text-[10.5px] text-[#9A9184]">{lab}</div>
            </div>
          ))}
        </div>

        <p className="mb-2 text-[12px] text-muted">AI 規劃後的最佳順序</p>
        <div className="mb-4 rounded-2xl border border-line bg-card px-3">
          {stops.map((s, i) => (
            <div
              key={s.placeId}
              className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
            >
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-red font-mono text-[12px] font-bold text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <h5 className="font-display text-[13.5px] font-semibold">
                  {s.name}
                </h5>
                <div className="text-[11px] text-[#9A9184]">{s.meta}</div>
              </div>
              <div className="font-mono text-[11.5px] font-bold text-teal">
                {s.dist} km
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-start gap-2.5 rounded-[14px] bg-paper-deep p-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red" />
          <p className="text-[12px] leading-relaxed text-[#5c564c]">
            已依目前位置規劃最佳順序：{order}。AI 將自動呼叫附近 yoxi 車輛，依序帶你完成任務。
          </p>
        </div>
      </ScreenScroll>
      <BottomBar>
        <p className="mb-1 text-center text-[11px] text-muted">
          出發與轉換：選擇你要怎麼完成這趟行程
        </p>
        <Button onClick={() => finish('ride')}>叫 yoxi 前往 🚗</Button>
        <Button variant="teal" onClick={() => finish('dining')}>
          餐廳訂位（跨界合作）🍽️
        </Button>
      </BottomBar>
    </>
  );
}
