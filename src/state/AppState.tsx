import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { DEFAULT_PROFILE, DEFAULT_QUIZ, MOCK_DAILY_TASK, MOCK_GPS } from '../data/mock';
import { fetchPlaces } from '../lib/api';
import { useGeolocation, type GeolocationStatus } from '../hooks/useGeolocation';
import type {
  Confirmation,
  Coord,
  DailyTask,
  Place,
  PlannedRoute,
  Profile,
  QuizAnswer,
} from '../types';

type PlacesStatus = 'idle' | 'loading' | 'ready' | 'error';

interface State {
  profile: Profile;
  quiz: QuizAnswer;
  /** 收藏地點：由後端（GAS + Sheets）提供，不再持久化到 localStorage */
  places: Place[];
  placesStatus: PlacesStatus;
  placesError: string | null;
  dailyTask: DailyTask;
  /** 使用者目前位置：GPS 成功＝真實座標；失敗／被拒＝fallback（台南市東區）；尚未定位＝null */
  userLocation: Coord | null;
  locationStatus: GeolocationStatus;
  /** userLocation 目前是不是 fallback（用來決定要不要顯示「暫時顯示預設位置」提示） */
  locationIsFallback: boolean;
  /** 在「選擇任務地點」畫面勾選的 id（可跨 saved / rec） */
  selectedPlaceIds: string[];
  route: PlannedRoute | null;
  confirmation: Confirmation | null;
}

type Action =
  | { type: 'setProfile'; patch: Partial<Profile> }
  | { type: 'completeOnboarding' }
  | { type: 'setQuiz'; patch: Partial<QuizAnswer> }
  | { type: 'submitQuiz'; answer: Omit<QuizAnswer, 'answeredAt'> }
  | { type: 'placesLoading' }
  | { type: 'placesLoaded'; places: Place[] }
  | { type: 'placesError'; message: string }
  | { type: 'setLocationStatus'; status: GeolocationStatus }
  | { type: 'setUserLocation'; coord: Coord; isFallback: boolean }
  | { type: 'addPlace'; place: Place }
  | { type: 'toggleSelected'; id: string }
  | { type: 'clearSelected' }
  | { type: 'setRoute'; route: PlannedRoute }
  | { type: 'setConfirmation'; confirmation: Confirmation }
  | { type: 'completeDailyTask' }
  | { type: 'reset' };

const STORAGE_KEY = 'yoxi.appstate.v1';

const initialState: State = {
  profile: DEFAULT_PROFILE,
  quiz: DEFAULT_QUIZ,
  places: [],
  placesStatus: 'idle',
  placesError: null,
  dailyTask: MOCK_DAILY_TASK,
  userLocation: null,
  locationStatus: 'idle',
  locationIsFallback: false,
  selectedPlaceIds: [],
  route: null,
  confirmation: null,
};

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw) as Partial<State>;
    return {
      ...initialState,
      ...saved,
      // 這些是後端資料 / 定位 / 流程暫存，不從 storage 還原
      places: [],
      placesStatus: 'idle',
      placesError: null,
      userLocation: null,
      locationStatus: 'idle',
      locationIsFallback: false,
      selectedPlaceIds: [],
      route: null,
      confirmation: null,
    };
  } catch {
    return initialState;
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'completeOnboarding':
      return { ...state, profile: { ...state.profile, onboarded: true } };
    case 'setQuiz':
      return { ...state, quiz: { ...state.quiz, ...action.patch } };
    case 'submitQuiz':
      return {
        ...state,
        quiz: { ...action.answer, answeredAt: new Date().toISOString() },
      };
    case 'placesLoading':
      return { ...state, placesStatus: 'loading', placesError: null };
    case 'placesLoaded': {
      // 保留本次 session 上傳過的預覽圖（後端目前不存 base64）
      const localImages = new Map(
        state.places
          .filter((p) => p.imageDataUrl)
          .map((p) => [p.id, p.imageDataUrl] as const),
      );
      return {
        ...state,
        places: action.places.map((p) =>
          localImages.has(p.id)
            ? { ...p, imageDataUrl: localImages.get(p.id) }
            : p,
        ),
        placesStatus: 'ready',
        placesError: null,
      };
    }
    case 'placesError':
      return { ...state, placesStatus: 'error', placesError: action.message };
    case 'setLocationStatus':
      return { ...state, locationStatus: action.status };
    case 'setUserLocation':
      return {
        ...state,
        userLocation: action.coord,
        locationIsFallback: action.isFallback,
      };
    case 'addPlace':
      // 樂觀更新：先塞進清單，回清單畫面時會再向後端拉一次覆蓋
      return { ...state, places: [action.place, ...state.places] };
    case 'toggleSelected': {
      const has = state.selectedPlaceIds.includes(action.id);
      return {
        ...state,
        selectedPlaceIds: has
          ? state.selectedPlaceIds.filter((x) => x !== action.id)
          : [...state.selectedPlaceIds, action.id],
      };
    }
    case 'clearSelected':
      return { ...state, selectedPlaceIds: [] };
    case 'setRoute':
      return { ...state, route: action.route };
    case 'setConfirmation':
      return { ...state, confirmation: action.confirmation };
    case 'completeDailyTask':
      return { ...state, dailyTask: { ...state.dailyTask, status: 'done' } };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

interface Ctx extends State {
  dispatch: Dispatch<Action>;
  /** 向後端重新抓收藏地點清單 */
  refreshPlaces: () => Promise<void>;
  /** 由需要定位的畫面在掛載時呼叫，觸發一次 GPS 權限請求 */
  ensureUserLocation: () => void;
}

const AppStateContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      const { profile, quiz, dailyTask } = state;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ profile, quiz, dailyTask }),
      );
    } catch {
      /* localStorage 不可用時略過（隱私視窗等） */
    }
  }, [state]);

  const refreshPlaces = useCallback(async () => {
    dispatch({ type: 'placesLoading' });
    try {
      const places = await fetchPlaces();
      dispatch({ type: 'placesLoaded', places });
    } catch (e) {
      dispatch({
        type: 'placesError',
        message: e instanceof Error ? e.message : '讀取收藏地點失敗',
      });
    }
  }, []);

  // App 一載入就先抓一次，首頁的收藏數等才會正確
  useEffect(() => {
    void refreshPlaces();
  }, [refreshPlaces]);

  // ── 真實 GPS 定位（hooks/useGeolocation）→ 同步進 app state
  const { status: geoStatus, position: geoPosition, requestLocation } =
    useGeolocation();

  useEffect(() => {
    dispatch({ type: 'setLocationStatus', status: geoStatus });
    if (geoStatus === 'success' && geoPosition) {
      dispatch({
        type: 'setUserLocation',
        coord: { lat: geoPosition.lat, lng: geoPosition.lng },
        isFallback: false,
      });
    } else if (
      geoStatus === 'denied' ||
      geoStatus === 'error' ||
      geoStatus === 'unsupported'
    ) {
      // 失敗 / 被拒 / 不支援 → 退回原型寫死的台南市東區座標
      dispatch({
        type: 'setUserLocation',
        coord: { lat: MOCK_GPS.lat, lng: MOCK_GPS.lng },
        isFallback: true,
      });
    }
  }, [geoStatus, geoPosition]);

  // 只在「還沒定位過」時觸發一次；成功或失敗後就不再自動重試，
  // 避免每次切畫面又跳權限請求、或出現「定位中…」與「預設位置」並存的狀態。
  const ensureUserLocation = useCallback(() => {
    if (geoStatus === 'idle') requestLocation();
  }, [geoStatus, requestLocation]);

  const value = useMemo<Ctx>(
    () => ({ ...state, dispatch, refreshPlaces, ensureUserLocation }),
    [state, refreshPlaces, ensureUserLocation],
  );
  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useApp 必須在 AppStateProvider 內使用');
  return ctx;
}
