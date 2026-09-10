import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BottomBar, Button, ScreenScroll, TopBar } from '../components/ui';
import { createPlace } from '../lib/api';
import { useApp } from '../state/AppState';

type NavState = { imageDataUrl?: string; fileName?: string };

const FIELDS = [
  { key: 'region', label: '地點' },
  { key: 'name', label: '店名' },
  { key: 'category', label: '種類' },
  { key: 'source', label: '來源' },
] as const;

export default function Upload2() {
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const state = (useLocation().state ?? {}) as NavState;

  const [phase, setPhase] = useState<'idle' | 'processing' | 'done'>('idle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // AI 擷取的示範結果（spec 2.4：前端只顯示可編輯的最終結果，不呈現 OCR 中間畫面）
  const [form, setForm] = useState({
    region: '台南市中西區',
    name: state.fileName || '林檎二訪咖啡',
    category: '咖啡廳',
    source: 'Instagram',
  });

  // 直接進到這頁但沒有帶圖片時，回上一步
  if (!state.imageDataUrl && phase === 'idle') {
    return <Navigate to="/places/upload" replace />;
  }

  const runExtract = () => {
    setPhase('processing');
    setTimeout(() => setPhase('done'), 900);
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
        // 截圖 base64 之後接 VLM／圖床再一起處理（spec 第 4 節 imageUrl 欄位）
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
              VLM 圖片轉文字辨識中…
            </div>
          )}
          {phase === 'done' && (
            <div className="rounded-xl bg-black/55 px-4 py-3 text-white">
              截圖已辨識 ✓
            </div>
          )}
        </div>

        {phase === 'done' && (
          <>
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
                  <span className="text-[12px] font-bold text-[#8A8175]">
                    {f.label}
                  </span>
                  <input
                    value={form[f.key]}
                    onChange={(e) =>
                      setForm({ ...form, [f.key]: e.target.value })
                    }
                    className="w-3/5 border-none bg-transparent py-0.5 text-right text-[13.5px] font-bold text-ink outline-none focus:border-b-[1.5px] focus:border-red"
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
            onClick={runExtract}
          >
            {phase === 'processing' ? '辨識中…' : '開始 AI 辨識'}
          </Button>
        )}
      </BottomBar>
    </>
  );
}
