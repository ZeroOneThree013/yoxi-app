import { useNavigate } from 'react-router-dom';
import yoxiLogo from '../assets/yoxi-logo.png';
import {
  BottomBar,
  Button,
  Field,
  ScreenScroll,
  StepDots,
  TextInput,
  WideAside,
} from '../components/ui';
import { useApp } from '../state/AppState';

export default function Onboarding1() {
  const navigate = useNavigate();
  const { profile, dispatch } = useApp();

  return (
    <>
      <ScreenScroll wide="split">
        <div className="wide:grid wide:grid-cols-[minmax(0,1fr)_320px] wide:items-center wide:gap-14">
          <div>
            <div className="mb-[18px] mt-3 aspect-square h-14 w-14 overflow-hidden rounded-2xl shadow-[0_6px_16px_-6px_rgba(255,33,12,0.55)] wide:hidden">
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
                  dispatch({
                    type: 'setProfile',
                    patch: { nickname: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="常出沒城市">
              <TextInput
                value={profile.city}
                placeholder="例如：台北市"
                onChange={(e) =>
                  dispatch({
                    type: 'setProfile',
                    patch: { city: e.target.value },
                  })
                }
              />
            </Field>
          </div>

          <WideAside
            title="嗨，先認識你一下"
            note="花不到一分鐘填寫基本資料與有空時段，yoxi 就能開始幫你安排每日任務與路線推薦。"
          />
        </div>
      </ScreenScroll>
      <BottomBar wide="split">
        <div className="wide:mx-auto wide:max-w-[420px]">
          <Button onClick={() => navigate('/onboarding/2')}>下一步</Button>
        </div>
      </BottomBar>
    </>
  );
}
