import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomBar, Button, ScreenScroll, TopBar } from '../components/ui';
import { MOCK_GPS, MOCK_RECOMMENDATIONS } from '../data/mock';
import { haversineKm, planRoute } from '../lib/route';
import { useApp } from '../state/AppState';
import type { Place } from '../types';

type Seg = 'saved' | 'rec';

function TaskRow({
  place,
  sub,
  selected,
  onToggle,
}: {
  place: Place;
  sub: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const km =
    Math.round(
      haversineKm(MOCK_GPS, { lat: place.lat, lng: place.lng }) * 10,
    ) / 10;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between border-b border-line px-1.5 py-3.5 text-left last:border-b-0 ${
        selected ? 'border-l-[3px] border-l-red bg-[#FBF1EC]' : 'border-l-[3px] border-l-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] text-[12px] text-white ${
            selected ? 'border-red bg-red' : 'border-line bg-card'
          }`}
        >
          {selected ? '✓' : ''}
        </span>
        <div>
          <h4 className="font-display text-[14px]">{place.name}</h4>
          <div className="text-[11px] text-[#9A9184]">{sub}</div>
        </div>
      </div>
      <div className="font-mono text-[12px] font-bold text-teal">{km} km</div>
    </button>
  );
}

export default function TaskSelect() {
  const navigate = useNavigate();
  const { places, selectedPlaceIds, dispatch } = useApp();
  const [seg, setSeg] = useState<Seg>('saved');

  const saved = places.filter((p) => !p.visited);

  const plan = () => {
    const all: Place[] = [...places, ...MOCK_RECOMMENDATIONS];
    let picked = all.filter((p) => selectedPlaceIds.includes(p.id));
    if (picked.length === 0) picked = saved.slice(0, 1);

    const route = planRoute(
      picked.map((p) => ({
        placeId: p.id,
        name: p.name,
        meta: `${p.category} · ${p.region}`,
        lat: p.lat,
        lng: p.lng,
      })),
    );
    dispatch({ type: 'setRoute', route });
    navigate('/route');
  };

  return (
    <>
      <TopBar title="選擇任務地點" back="/home" />
      <ScreenScroll>
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-teal-soft px-3 py-2.5 text-[12px] font-semibold text-teal">
          📡 已定位：目前在{MOCK_GPS.label}
        </div>

        <div className="mb-4 flex rounded-[14px] bg-paper-deep p-1">
          {(
            [
              ['saved', '已存未去'],
              ['rec', '依偏好推薦'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSeg(key)}
              className={`flex-1 rounded-[11px] py-2.5 text-[12.5px] font-bold ${
                seg === key ? 'bg-card text-ink shadow-card' : 'text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-2.5 text-[11.5px] text-muted">
          可複選多個地點，AI 會依目前位置規劃最佳順序
        </p>

        <div className="mb-4 rounded-2xl border border-line bg-card px-3">
          {seg === 'saved'
            ? saved.map((p) => (
                <TaskRow
                  key={p.id}
                  place={p}
                  sub={`${p.category} · ${p.region}`}
                  selected={selectedPlaceIds.includes(p.id)}
                  onToggle={() => dispatch({ type: 'toggleSelected', id: p.id })}
                />
              ))
            : MOCK_RECOMMENDATIONS.map((p) => (
                <TaskRow
                  key={p.id}
                  place={p}
                  sub={`推薦・${p.reason} · ${p.region}`}
                  selected={selectedPlaceIds.includes(p.id)}
                  onToggle={() => dispatch({ type: 'toggleSelected', id: p.id })}
                />
              ))}
        </div>

        <div className="flex items-center justify-between rounded-[14px] bg-ink px-4 py-3 text-[12.5px] font-bold text-white">
          <span>
            已選{' '}
            <span className="font-mono text-mustard">
              {selectedPlaceIds.length}
            </span>{' '}
            個地點，將依此規劃順序
          </span>
        </div>
      </ScreenScroll>
      <BottomBar>
        <Button onClick={plan}>讓 AI Agent 規劃路線</Button>
      </BottomBar>
    </>
  );
}
