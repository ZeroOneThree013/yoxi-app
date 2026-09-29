import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BottomBar,
  Button,
  Chip,
  Field,
  RuleCard,
  ScreenScroll,
  TextInput,
  TopBar,
  WideAside,
} from '../components/ui';
import LocationStrip from '../components/LocationStrip';
import { QUICK_DESTINATIONS } from '../data/mock';
import { estimateQuickRide } from '../lib/route';
import { useApp } from '../state/AppState';

export default function QuickRide() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const [dest, setDest] = useState('');

  const est = useMemo(
    () => (dest.trim() ? estimateQuickRide(dest.trim()) : null),
    [dest],
  );

  const call = () => {
    dispatch({
      type: 'setConfirmation',
      confirmation: {
        kind: 'quick',
        title: 'yoxi 已幫你叫車！',
        context: `前往：${dest.trim() || '未指定目的地'}`,
        reward: false, // 單純叫車不觸發任務／徽章／地圖點亮（spec 2.7）
      },
    });
    navigate('/confirm');
  };

  return (
    <>
      <TopBar title="叫 yoxi" back="/home" wide="split" />
      <ScreenScroll wide="split">
        <div className="wide:grid wide:grid-cols-[minmax(0,1fr)_320px] wide:items-start wide:gap-10">
          <div>
            <p className="mb-3.5 mt-2 text-[12.5px] text-muted">
              不需要規劃行程，輸入目的地直接叫車。
            </p>

            <LocationStrip label="上車地點" />

            <Field label="目的地">
              <TextInput
                value={dest}
                placeholder="輸入地址或地標，例如：台南火車站"
                onChange={(e) => setDest(e.target.value)}
              />
            </Field>

            <Field label="快速選擇">
              <div className="flex flex-wrap gap-2">
                {QUICK_DESTINATIONS.map((q) => (
                  <Chip key={q.label} onClick={() => setDest(q.value)}>
                    {q.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <RuleCard title="預估車資">
              {est
                ? `約 ${est.km} km · ${est.min} 分鐘車程 · 預估 $${est.cost}`
                : '輸入目的地後即可預估車程與車資'}
            </RuleCard>
          </div>

          <WideAside
            title="只是想搭車？"
            note="不用規劃行程，直接輸入目的地叫 yoxi 就好"
          />
        </div>
      </ScreenScroll>
      <BottomBar wide="split">
        <div className="wide:mx-auto wide:max-w-[calc(100%-360px)]">
          <Button onClick={call}>叫 yoxi 出發 🚗</Button>
        </div>
      </BottomBar>
    </>
  );
}
