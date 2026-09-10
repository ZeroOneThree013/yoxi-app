import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  DEFAULT_PROFILE,
  DEFAULT_QUIZ,
  MOCK_DAILY_TASK,
  MOCK_PLACES,
} from '../data/mock';
import type {
  Confirmation,
  DailyTask,
  Place,
  PlannedRoute,
  Profile,
  QuizAnswer,
} from '../types';

interface State {
  profile: Profile;
  quiz: QuizAnswer;
  places: Place[];
  dailyTask: DailyTask;
  /** 目前在「選擇任務地點」畫面勾選的 id（可跨 saved / rec） */
  selectedPlaceIds: string[];
  /** AI 規劃後的路線，供 route / confirm 畫面使用 */
  route: PlannedRoute | null;
  /** 確認頁內容 */
  confirmation: Confirmation | null;
}

type Action =
  | { type: 'setProfile'; patch: Partial<Profile> }
  | { type: 'completeOnboarding' }
  | { type: 'setQuiz'; patch: Partial<QuizAnswer> }
  | { type: 'submitQuiz'; answer: Omit<QuizAnswer, 'answeredAt'> }
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
  places: MOCK_PLACES,
  dailyTask: MOCK_DAILY_TASK,
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
      // 這幾項是流程中的暫存，不從 storage 還原
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
    case 'addPlace':
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
      return { ...initialState, places: MOCK_PLACES };
    default:
      return state;
  }
}

interface Ctx extends State {
  dispatch: Dispatch<Action>;
}

const AppStateContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      const { profile, quiz, places, dailyTask } = state;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ profile, quiz, places, dailyTask }),
      );
    } catch {
      /* localStorage 不可用時略過（隱私視窗等） */
    }
  }, [state]);

  const value = useMemo<Ctx>(() => ({ ...state, dispatch }), [state]);
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
