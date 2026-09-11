import { useNavigate } from 'react-router-dom';
import yoxiLogo from '../assets/yoxi-logo.png';
import {
  BottomBar,
  Button,
  Field,
  ScreenScroll,
  StepDots,
  TextInput,
} from '../components/ui';
import { useApp } from '../state/AppState';

export default function Onboarding1() {
  const navigate = useNavigate();
  const { profile, dispatch } = useApp();

  return (
    <>
      <ScreenScroll>
        <div className="mb-[18px] mt-3 aspect-square h-14 w-14 overflow-hidden rounded-2xl shadow-[0_6px_16px_-6px_rgba(255,33,12,0.55)]">
          <img
            src={yoxiLogo}
            alt="yoxi"
            className="h-full w-full object-contain"
          />
        </div>
        <StepDots step={1} />
        <h2 className="mb-1.5 font-display text-[23px] font-semibold">
          先認識你一下
        </h2>
        <p className="mb-6 text-[13px] text-muted">
          填寫基本資料，讓 yoxi 更懂你的出行習慣。
        </p>

        <Field label="暱稱">
          <TextInput
            value={profile.nickname}
            placeholder="例如：阿哲"
            onChange={(e) =>
              dispatch({ type: 'setProfile', patch: { nickname: e.target.value } })
            }
          />
        </Field>
        <Field label="常出沒城市">
          <TextInput
            value={profile.city}
            placeholder="例如：台北市"
            onChange={(e) =>
              dispatch({ type: 'setProfile', patch: { city: e.target.value } })
            }
          />
        </Field>
      </ScreenScroll>
      <BottomBar>
        <Button onClick={() => navigate('/onboarding/2')}>下一步</Button>
      </BottomBar>
    </>
  );
}
