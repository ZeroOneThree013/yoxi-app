import BottomNav from '../components/BottomNav';
import HomeCard from '../components/HomeCard';
import { ScreenScroll, StatPill, TopBar } from '../components/ui';
import { MOCK_BADGES } from '../data/mock';
import { useApp } from '../state/AppState';

export default function Tasks() {
  const { dailyTask } = useApp();

  return (
    <>
      <TopBar title="每日任務" back="/home" />
      <ScreenScroll>
        <p className="mb-4 mt-2 text-[12.5px] text-muted">
          沒有積分制，完成任務可以獲得徽章，或讓地圖上多亮起一個角落。
        </p>

        <HomeCard
          tag="任務一"
          tagTone="mustard"
          title="今日推薦任務"
          to="/tasks/daily"
          footer={
            <StatPill>
              {dailyTask.status === 'done' ? '已完成 ✓' : '進行中'}
            </StatPill>
          }
        >
          AI 依你有空的時段不定時推送小任務，例如「{dailyTask.window} 完成一趟
          {dailyTask.category}行程」
        </HomeCard>

        <HomeCard
          tag="任務二"
          title="節氣・季節限定地點"
          to="/tasks/badges"
          footer={
            <div className="grid w-full grid-cols-6 gap-2">
              {MOCK_BADGES.map((b) => (
                <div
                  key={b.name}
                  className={`flex aspect-square items-center justify-center rounded-xl text-[15px] ${
                    b.unlocked
                      ? 'border border-mustard bg-mustard'
                      : 'border-[1.5px] border-dashed border-line bg-card opacity-60'
                  }`}
                >
                  {b.icon}
                </div>
              ))}
            </div>
          }
        >
          收藏的地點若符合節氣或季節限定條件，實際造訪即可解鎖專屬徽章
        </HomeCard>
      </ScreenScroll>
      <BottomNav />
    </>
  );
}
