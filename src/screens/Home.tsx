import HomeCard from '../components/HomeCard';
import BottomNav from '../components/BottomNav';
import { ScreenScroll, StatPill } from '../components/ui';
import { MOCK_BADGES } from '../data/mock';
import { useApp } from '../state/AppState';

export default function Home() {
  const { profile, quiz, places, dailyTask } = useApp();

  const unvisited = places.filter((p) => !p.visited).length;
  const tainan = places.filter((p) => p.region.includes('台南')).length;
  const unlockedBadges = MOCK_BADGES.filter((b) => b.unlocked).length;

  const quizSummary = quiz.answeredAt
    ? `今天已回答：${quiz.mood} · 想去 ${quiz.direction} · 出走指數 ${quiz.score}`
    : '花十秒回答心情與想去的方向，讓 AI 更懂你';

  const agentHint = quiz.answeredAt
    ? `已依你今天的狀態（${quiz.mood} · ${quiz.direction} · 指數 ${quiz.score}）調整推薦路線與地點`
    : '依目前位置與收藏地點，AI 規劃最佳路線並幫你叫 yoxi';

  return (
    <>
      <ScreenScroll>
        <div className="mb-5 mt-3">
          <div className="text-[13px] font-bold text-red-deep">
            嗨，{profile.nickname || '旅人'}
          </div>
          <h2 className="mt-1 font-display text-[24px]">今天想去哪裡晃晃？</h2>
        </div>

        <HomeCard tag="每日互動" tagTone="mustard" title="今天，過得怎麼樣？" to="/quiz">
          {quizSummary}
        </HomeCard>

        <HomeCard
          tag="每日任務"
          tagTone="mustard"
          title="今天的推薦任務"
          to="/tasks"
          footer={
            <>
              <StatPill>
                {dailyTask.status === 'done' ? '已完成 ✓' : '進行中'}
              </StatPill>
              <StatPill tone="mustard">
                已集 {unlockedBadges}/{MOCK_BADGES.length} 枚徽章
              </StatPill>
            </>
          }
        >
          不定時推送的小任務，完成可解鎖徽章、點亮地圖
        </HomeCard>

        <HomeCard
          tag="想去的地方"
          title={`你收藏了 ${places.length} 個地點`}
          to="/places"
          footer={<StatPill>還有 {unvisited} 個尚未去過</StatPill>}
        >
          來自 IG、Facebook、Google Maps 截圖 · {tainan} 個在台南
        </HomeCard>

        <HomeCard tag="AI Agent" tagTone="red" title="幫我規劃今天的路線" to="/plan">
          {agentHint}
        </HomeCard>

        <HomeCard tag="單純叫車" title="只是想搭車？" to="/quick-ride">
          不用規劃行程，直接輸入目的地叫 yoxi 就好
        </HomeCard>
      </ScreenScroll>
      <BottomNav />
    </>
  );
}
