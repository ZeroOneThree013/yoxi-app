import { useCallback, useRef, useState } from 'react';

/**
 * 包裝瀏覽器原生 navigator.geolocation.getCurrentPosition。
 *
 * 狀態：
 *   idle        還沒要求過
 *   loading     定位中
 *   success     成功（position 有 lat / lng / accuracy）
 *   denied      使用者拒絕位置權限
 *   unsupported 瀏覽器不支援
 *   error       逾時或其他錯誤
 *
 * requestLocation()：由畫面在「使用者進入該畫面時」呼叫，
 * 不要一開 App 就觸發，免得一開場就跳權限視窗嚇到人。
 */

export type GeolocationStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface GeolocationResult {
  status: GeolocationStatus;
  position: GeolocationPosition | null;
  error: string | null;
  requestLocation: () => void;
}

// 先求快、不求精準（enableHighAccuracy: false），8 秒逾時
const OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 60_000,
};

interface InternalState {
  status: GeolocationStatus;
  position: GeolocationPosition | null;
  error: string | null;
}

export function useGeolocation(): GeolocationResult {
  const [state, setState] = useState<InternalState>({
    status: 'idle',
    position: null,
    error: null,
  });
  const inFlight = useRef(false);

  const requestLocation = useCallback(() => {
    if (inFlight.current) return;

    if (
      typeof navigator === 'undefined' ||
      !('geolocation' in navigator) ||
      !navigator.geolocation
    ) {
      setState({
        status: 'unsupported',
        position: null,
        error: '此瀏覽器不支援定位功能',
      });
      return;
    }

    inFlight.current = true;
    setState((s) => ({ ...s, status: 'loading', error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        inFlight.current = false;
        setState({
          status: 'success',
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          error: null,
        });
      },
      (err) => {
        inFlight.current = false;
        const denied = err.code === err.PERMISSION_DENIED;
        const timeout = err.code === err.TIMEOUT;
        setState({
          status: denied ? 'denied' : 'error',
          position: null,
          error: denied
            ? '已拒絕位置權限'
            : timeout
              ? '定位逾時'
              : err.message || '定位失敗',
        });
      },
      OPTIONS,
    );
  }, []);

  return { ...state, requestLocation };
}
