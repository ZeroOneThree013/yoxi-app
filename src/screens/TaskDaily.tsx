import { BottomBar, Button, RuleCard, ScreenScroll, TopBar } from '../components/ui';
import { useApp } from '../state/AppState';

export default function TaskDaily() {
  const { dailyTask, dispatch } = useApp();
  const done = dailyTask.status === 'done';

  return (
    <>
      <TopBar title="今日推薦任務" back="/tasks" />
      <ScreenScroll>
        <RuleCard
          title="🔔 現在的推薦任務"
          className="border-[#F3CFC5] bg-[#FFF6F3]"
        >
          <span className="text-ink">
            <strong className="font-mono">{dailyTask.window}</strong>
            {dailyTask.description}
          </span>
        </RuleCard>

        <RuleCard title="怎麼運作？">
          AI 會依你在 onboarding 填寫的有空時段，不定時推送像這樣的小任務。任務沒有連續天數壓力，錯過這次，下次有空檔時還會再推薦。
        </RuleCard>

        <RuleCard title="完成後獲得">
          地圖上會點亮這次造訪的區域；如果剛好是節氣或季節限定地點，還會額外解鎖專屬徽章。
        </RuleCard>

        <div
          className={`mt-3.5 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11.5px] leading-relaxed ${
            done ? 'bg-teal-soft text-teal' : 'bg-[#F9DED5] text-red-deep'
          }`}
        >
          <span>{done ? '🗺️' : '⏰'}</span>
          <p>
            {done
              ? '任務完成！地圖上已點亮新的角落'
              : '任務進行中，還沒前往任務地點'}
          </p>
        </div>
      </ScreenScroll>
      <BottomBar>
        <Button
          disabled={done}
          onClick={() => dispatch({ type: 'completeDailyTask' })}
        >
          {done ? '任務已完成 ✓' : '前往任務地點'}
        </Button>
      </BottomBar>
    </>
  );
}
