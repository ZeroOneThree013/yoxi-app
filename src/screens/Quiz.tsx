import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BottomBar,
  Button,
  Chip,
  Field,
  ScreenScroll,
  StepDots,
  TopBar,
} from '../components/ui';
import { DIRECTIONS, MOODS } from '../data/mock';
import { useApp } from '../state/AppState';

export default function Quiz() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { quiz, dispatch } = useApp();

  const isOnboarding = pathname.startsWith('/onboarding');
  const backTo = isOnboarding ? '/onboarding/2' : '/home';

  const [mood, setMood] = useState(quiz.mood);
  const [direction, setDirection] = useState(quiz.direction);
  const [score, setScore] = useState(quiz.score);

  const submit = () => {
    dispatch({ type: 'submitQuiz', answer: { mood, direction, score } });
    if (isOnboarding) dispatch({ type: 'completeOnboarding' });
    navigate('/home');
  };

  return (
    <>
      <TopBar back={backTo} />
      <ScreenScroll>
        <StepDots step={3} />
        <h2 className="mb-1.5 font-display text-[23px] font-semibold">
          今天，過得怎麼樣？
        </h2>
        <p className="mb-5 text-[13px] text-muted">
          花十秒回答，AI 會依此調整今天的地點推薦。
        </p>

        <Field label="心情">
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <Chip key={m} selected={mood === m} onClick={() => setMood(m)}>
                {m}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="想去的方向">
          <div className="flex flex-wrap gap-2">
            {DIRECTIONS.map((d) => (
              <Chip
                key={d}
                selected={direction === d}
                onClick={() => setDirection(d)}
              >
                {d}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={`出走指數：${score} / 10`}>
          <input
            type="range"
            min={1}
            max={10}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full accent-red"
          />
        </Field>
      </ScreenScroll>
      <BottomBar>
        <Button onClick={submit}>送出，看看 AI 怎麼推薦</Button>
      </BottomBar>
    </>
  );
}
