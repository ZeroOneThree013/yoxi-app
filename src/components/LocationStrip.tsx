import { useEffect } from 'react';
import { MOCK_GPS } from '../data/mock';
import { useApp } from '../state/AppState';

/**
 * GPS 定位提示條。放在需要「使用者目前位置」的畫面頂端。
 * 掛載時觸發一次定位請求，並顯示三種狀態：
 *   定位中 / 已定位（真實座標）/ 失敗退回預設位置
 */
export default function LocationStrip({ label }: { label: string }) {
  const { userLocation, locationStatus, locationIsFallback, ensureUserLocation } =
    useApp();

  useEffect(() => {
    ensureUserLocation();
  }, [ensureUserLocation]);

  const locating = locationStatus === 'idle' || locationStatus === 'loading';

  let text: string;
  if (locating) {
    text = `${label}：定位中…`;
  } else if (userLocation && !locationIsFallback) {
    text = `${label}：已定位 · ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
  } else {
    text = `${label}：${MOCK_GPS.label}（預設位置）`;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 rounded-xl bg-teal-soft px-3 py-2.5 text-[12px] font-semibold text-teal">
        <span>📡</span>
        <span>{text}</span>
      </div>
      {locationIsFallback && (
        <p className="mt-1.5 px-1 text-[11px] text-muted">
          無法取得您的位置，暫時顯示預設位置
        </p>
      )}
    </div>
  );
}
