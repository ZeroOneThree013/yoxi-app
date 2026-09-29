import { useNavigate } from 'react-router-dom';
import {
  BottomBar,
  Button,
  Chip,
  Field,
  ScreenScroll,
  StepDots,
  TopBar,
  WideAside,
} from '../components/ui';
import { TIME_SLOTS, WEEKDAYS } from '../data/mock';
import { useApp } from '../state/AppState';

export default function Onboarding2() {
  const navigate = useNavigate();
  const { profile, dispatch } = useApp();

  const toggle = (key: 'freeDays' | 'freeSlots', value: string) => {
    const list = profile[key];
    const next = list.includes(value)
      ? list.filter((x) => x !== value)
      : [...list, value];
    dispatch({ type: 'setProfile', patch: { [key]: next } });
  };

  return (
    <>
      <TopBar back={-1} wide="split" />
      <ScreenScroll wide="split">
        <div className="wide:grid wide:grid-cols-[minmax(0,1fr)_320px] wide:items-center wide:gap-14">
          <div>
            <StepDots step={2} />
            <h2 className="mb-1.5 font-display text-[23px] font-semibold">
              一週中，你何時有空？
            </h2>
            <p className="mb-5 text-[13px] text-muted">
              用來安排每日任務提醒與行程推薦時機。
            </p>

            <Field label="有空的星期">
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <Chip
                    key={d}
                    selected={profile.freeDays.includes(d)}
                    onClick={() => toggle('freeDays', d)}
                  >
                    {d}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="常見有空時段">
              <div className="flex flex-wrap gap-2">
                {TIME_SLOTS.map((s) => (
                  <Chip
                    key={s}
                    selected={profile.freeSlots.includes(s)}
                    onClick={() => toggle('freeSlots', s)}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>

          <WideAside
            title="何時有空？"
            note="AI 會依你填寫的星期與時段，不定時推送每日任務提醒與行程推薦。"
          />
        </div>
      </ScreenScroll>
      <BottomBar wide="split">
        <div className="wide:mx-auto wide:max-w-[420px]">
          <Button onClick={() => navigate('/onboarding/quiz')}>下一步</Button>
        </div>
      </BottomBar>
    </>
  );
}
