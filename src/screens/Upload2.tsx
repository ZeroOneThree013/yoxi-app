import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BottomBar, Button, ScreenScroll, TopBar } from '../components/ui';
import { createPlace, recognizePlace } from '../lib/api';
import { useApp } from '../state/AppState';

type NavState = { imageDataUrl?: string; fileName?: string };

const FIELDS = [
  { key: 'region', label: '地點', placeholder: '例如：台南市中西區' },
  { key: 'name', label: '店名', placeholder: '尚未辨識，請手動輸入' },
  { key: 'category', label: '種類', placeholder: '例如：咖啡廳' },
  { key: 'source', label: '來源', placeholder: '例如：Instagram' },
] as const;

const EMPTY_FORM = { region: '', name: '', category: '', source: '' };
const EMPTY_COORDS: { lat: number | null; lng: number | null } = {
  lat: null,
  lng: null,
};

export default function Upload2() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const state = (useLocation().state ?? {}) as NavState;

  const [phase, setPhase] = useState<'idle' | 'processing' | 'done'>('idle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recognizeError, setRecognizeError] = useState<string | null>(null);
  // 前端只顯示可編輯的最終結果，不呈現辨識過程的中間畫面（spec 2.4）
  const [form, setForm] = useState(EMPTY_FORM);
  // 辨識順便估算的座標：背景帶去存檔用，不給使用者看／編輯（spec 這次的需求）
  const [coords, setCoords] = useState(EMPTY_COORDS);

  // 直接進到這頁但沒有帶圖片時，回上一步
  if (!state.imageDataUrl && phase === 'idle') {
    return <Navigate to="/places/upload" replace />;
  }

  const runExtract = async () => {
    if (!state.imageDataUrl) return;
    setPhase('processing');
    setRecognizeError(null);
    try {
      const result = await recognizePlace(state.imageDataUrl);
      setForm({
        region: result.region,
        name: result.storeName,
        category: result.category || '未分類',
        source: result.source || '截圖上傳',
      });
      setCoords({ lat: result.lat, lng: result.lng });
    } catch (e) {
      // Fallback：Gemini 額度用完／服務不穩／辨識不出來都會走到這裡。
      // 欄位留白讓使用者手動填寫，不能卡住整個流程。
      setForm(EMPTY_FORM);
      setCoords(EMPTY_COORDS);
      setRecognizeError(e instanceof Error ? e.message : '辨識失敗，請手動填寫');
    } finally {
      setPhase('done');
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const place = await createPlace({
        storeName: form.name.trim() || '未命名地點',
        region: form.region.trim(),
        category: form.category.trim() || '未分類',
        source: form.source.trim() || '截圖上傳',
        // 截圖 base64 之後接圖床再一起處理（spec 第 4 節 imageUrl 欄位）
        // 辨識順便估算的大概座標，背景帶過去，使用者不用看到這兩個數字
        lat: coords.lat,
        lng: coords.lng,
      });
      dispatch({
        type: 'addPlace',
        // 保留本次上傳的預覽圖，讓導回清單後仍看得到縮圖
        place: { ...place, imageDataUrl: state.imageDataUrl ?? place.imageDataUrl },
      });
      navigate('/places');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '儲存失敗，請再試一次');
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="辨識截圖內容" back="/places/upload" />
      <ScreenScroll>
        <div
          className="relative mb-4 flex h-[200px] items-center justify-center overflow-hidden rounded-2xl bg-cover bg-center font-mono text-[12px] text-[#8C6410]"
          style={{
            backgroundImage: state.imageDataUrl
              ? `url(${state.imageDataUrl})`
              : undefined,
          }}
        >
          {phase === 'processing' && (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-black/55 px-4 py-3 text-white">
              <div className="spinner" />
              AI 辨識截圖中…
            </div>
          )}
          {phase === 'done' && (
            <div className="rounded-xl bg-black/55 px-4 py-3 text-white">
              {recognizeError ? '辨識未完成，可手動填寫' : '截圖已辨識 ✓'}
            </div>
          )}
        </div>

        {phase === 'done' && (
          <>
            {recognizeError && (
              <p className="mb-2 rounded-lg bg-[#F9DED5] px-3 py-2 text-[11.5px] leading-relaxed text-red-deep">
                {recognizeError}，請直接手動填寫下方欄位。
              </p>
            )}
            <p className="mb-1.5 text-[12px] text-muted">
              AI 擷取的關鍵字（可手動修改）
            </p>
            <div className="rounded-2xl border border-line bg-card px-3.5">
              {FIELDS.map((f, i) => (
                <div
                  key={f.key}
                  className={`flex items-center justify-between py-2.5 ${
                    i < FIELDS.length - 1 ? 'border-b border-line' : ''
                  }`}
                >
                  <span className="shrink-0 text-[12px] font-bold text-[#8A8175]">
                    {f.label}
                  </span>
                  <input
                    value={form[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setForm({ ...form, [f.key]: e.target.value })
                    }
                    className="w-3/5 border-none bg-transparent py-0.5 text-right text-[13.5px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-[#B3AB9E] focus:border-b-[1.5px] focus:border-red"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11.5px] text-muted">
              關鍵字將用於「地區」與「種類偏好」推薦引擎，儲存後會直接加入收藏清單。
            </p>
          </>
        )}
      </ScreenScroll>
      <BottomBar>
        {saveError && (
          <p className="text-center text-[12px] text-red-deep">{saveError}</p>
        )}
        {phase === 'done' ? (
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? '儲存中…' : '儲存到「想去的地方」'}
          </Button>
        ) : (
          <Button
            variant="teal"
            disabled={phase === 'processing'}
            onClick={() => void runExtract()}
          >
            {phase === 'processing' ? '辨識中…' : '開始 AI 辨識'}
          </Button>
        )}
      </BottomBar>
    </>
  );
}
