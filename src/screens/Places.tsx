import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import PlaceCard from '../components/PlaceCard';
import { Button, ScreenScroll, TopBar } from '../components/ui';
import { useApp } from '../state/AppState';

export default function Places() {
  const navigate = useNavigate();
  const { places, placesStatus, placesError, refreshPlaces } = useApp();

  // 掛載時向後端重抓一次（新增後回到這頁也會拿到最新清單）
  useEffect(() => {
    void refreshPlaces();
  }, [refreshPlaces]);

  const firstLoad = placesStatus === 'loading' && places.length === 0;
  const hardError = placesStatus === 'error' && places.length === 0;
  const emptyList = placesStatus === 'ready' && places.length === 0;

  return (
    <>
      <TopBar title="想去的地方" back="/home" />
      <ScreenScroll>
        <div className="wide:grid wide:grid-cols-[280px_minmax(0,1fr)] wide:items-start wide:gap-10">
          <aside className="hidden wide:sticky wide:top-28 wide:flex wide:flex-col wide:gap-4 wide:rounded-[28px] wide:border wide:border-line wide:bg-card wide:p-7">
            <h2 className="font-display text-[22px] leading-snug">
              你收藏了 {places.length} 個地點
            </h2>
            <p className="text-[13px] leading-relaxed text-muted">
              截圖 IG／FB／Google Maps 存下想去的地方，點卡片就能丟給 AI Agent 排行程。
            </p>
            <Button onClick={() => navigate('/places/upload')}>
              ＋ 上傳截圖新增
            </Button>
          </aside>

          <div>
            <p className="mb-3 mt-2 text-[12.5px] text-muted wide:hidden">
              截圖 IG／FB／Google Maps 存下想去的地方，點卡片就能丟給 AI Agent 排行程。
            </p>

            {/* 更新失敗但仍有舊資料時的輕提示 */}
            {placesStatus === 'error' && places.length > 0 && (
              <p className="mb-3 rounded-lg bg-[#F9DED5] px-3 py-2 text-[11.5px] text-red-deep">
                更新失敗（{placesError}），以下是先前載入的資料
              </p>
            )}

            {firstLoad && (
              <div className="wide:grid wide:grid-cols-2 wide:gap-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="mb-3 h-[92px] animate-pulse rounded-l-[14px] rounded-r-[4px] border border-line bg-card/60 wide:mb-0"
                  />
                ))}
              </div>
            )}

            {hardError && (
              <div className="rounded-2xl border border-line bg-[#F9DED5] p-4 text-[12.5px] text-red-deep">
                <p className="mb-3 leading-relaxed">讀取收藏地點失敗：{placesError}</p>
                <Button variant="ghost" onClick={() => void refreshPlaces()}>
                  重新載入
                </Button>
              </div>
            )}

            {emptyList && (
              <div className="mt-12 text-center text-[13px] leading-relaxed text-muted">
                <div className="mb-2 text-[32px]">📍</div>
                還沒有收藏任何地方
                <br />
                點右下角的「＋」上傳截圖新增
              </div>
            )}

            <div className="wide:grid wide:grid-cols-2 wide:gap-4">
              {places.map((p) => (
                <PlaceCard
                  key={p.id}
                  place={p}
                  onClick={() => navigate('/plan')}
                />
              ))}
            </div>
          </div>
        </div>
      </ScreenScroll>

      <button
        type="button"
        aria-label="新增收藏地點"
        onClick={() => navigate('/places/upload')}
        className="absolute bottom-24 right-5 z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-red text-[24px] text-white shadow-[0_10px_20px_-6px_rgba(226,75,52,0.6)] active:scale-95 wide:hidden"
      >
        ＋
      </button>
      <BottomNav />
    </>
  );
}
