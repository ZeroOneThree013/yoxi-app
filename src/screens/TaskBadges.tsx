import { useNavigate } from 'react-router-dom';
import { BottomBar, Button, RuleCard, ScreenScroll, TopBar } from '../components/ui';
import { MOCK_BADGES } from '../data/mock';

export default function TaskBadges() {
  const navigate = useNavigate();
  const unlocked = MOCK_BADGES.filter((b) => b.unlocked).length;

  return (
    <>
      <TopBar title="節氣・季節限定地點" back="/tasks" />
      <ScreenScroll>
        <p className="mb-1 mt-2 text-[12.5px] text-muted">
          徽章收集牆（已解鎖 {unlocked} / {MOCK_BADGES.length}）
        </p>

        <div className="mb-4 grid grid-cols-6 gap-2">
          {MOCK_BADGES.map((b) => (
            <div
              key={b.name}
              title={b.name}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-[18px] ${
                b.unlocked
                  ? 'border border-mustard bg-mustard text-white'
                  : 'border-[1.5px] border-dashed border-line bg-card opacity-60'
              }`}
            >
              {b.icon}
            </div>
          ))}
        </div>

        <RuleCard title="規則說明">
          收藏的地點若符合節氣或季節限定條件（例如夏至剉冰店、冬至湯圓店），實際造訪後即可解鎖對應的專屬徽章，收集在個人徽章牆上。
        </RuleCard>

        <RuleCard title="已解鎖">
          🌸 春分・賞花地點｜🍧 夏至・剉冰限定，都已收藏並完成造訪。
        </RuleCard>

        <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-teal-soft px-3 py-2.5 text-[11.5px] leading-relaxed text-teal">
          <span>💡</span>
          <p>「深夜燒肉專門店」符合秋季限定條件，前往後可解鎖 🍁 徽章！</p>
        </div>
      </ScreenScroll>
      <BottomBar>
        <Button onClick={() => navigate('/places')}>查看想去的地方</Button>
      </BottomBar>
    </>
  );
}
