import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import PlaceCard from '../components/PlaceCard';
import { ScreenScroll, TopBar } from '../components/ui';
import { useApp } from '../state/AppState';

export default function Places() {
  const navigate = useNavigate();
  const { places } = useApp();

  return (
    <>
      <TopBar title="想去的地方" back="/home" />
      <ScreenScroll>
        <p className="mb-3 mt-2 text-[12.5px] text-muted">
          截圖 IG／FB／Google Maps 存下想去的地方，點卡片就能丟給 AI Agent 排行程。
        </p>
        {places.map((p) => (
          <PlaceCard key={p.id} place={p} onClick={() => navigate('/plan')} />
        ))}
      </ScreenScroll>

      <button
        type="button"
        aria-label="新增收藏地點"
        onClick={() => navigate('/places/upload')}
        className="absolute bottom-24 right-5 z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-red text-[24px] text-white shadow-[0_10px_20px_-6px_rgba(226,75,52,0.6)] active:scale-95"
      >
        ＋
      </button>
      <BottomNav />
    </>
  );
}
