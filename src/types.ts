// 資料結構對照 spec 第 2 節。此階段全部是 mock，之後照 spec 第 4 節換成真實串接。

export interface Coord {
  lat: number;
  lng: number;
}

/** 節氣／季節限定條件（spec 2.3 任務二） */
export interface SeasonalBadge {
  icon: string;
  name: string;
  season: string;
  /** 造訪後是否已解鎖 */
  unlocked: boolean;
}

/** 收藏地點（spec 2.4） */
export interface Place {
  id: string;
  /** 店名 */
  name: string;
  /** 地點（可能是地區，如台南） */
  region: string;
  /** 種類（用於推薦偏好） */
  category: string;
  /** 來源：Instagram / Facebook / Google Maps 截圖 */
  source: string;
  /**
   * 經緯度。截圖辨識（Gemini）時會順便依世界知識估算大概座標；Gemini 沒把握、
   * 或地點是手動輸入沒走辨識，就是 null——不是精確 GPS，也沒接真正的 geocoding
   * 服務，準確度依地點知名度而定（見 gas/README.md）。
   * 路線規劃畫面用 lib/route.ts 的 placeCoord() 取用：有實值就用，沒有才 fallback
   * 回原型假座標。這兩個值不在任何畫面直接顯示／編輯。
   */
  lat?: number | null;
  lng?: number | null;
  /** 是否已造訪過 */
  visited: boolean;
  /** 使用者上傳的截圖（DataURL），mock 階段可有可無 */
  imageDataUrl?: string;
  /** 若符合節氣／季節限定條件 */
  seasonal?: SeasonalBadge;
}

/** 依偏好推薦的地點（spec 2.5 segment「依偏好推薦」） */
export interface RecommendedPlace extends Place {
  /** 推薦理由，例如「咖啡廳偏好」 */
  reason: string;
}

/** 十秒問答結果（spec 2.1 / 2.2 每日互動） */
export interface QuizAnswer {
  mood: string;
  direction: string;
  /** 出走指數 1–10 */
  score: number;
  /** ISO 字串，null = 今天還沒回答 */
  answeredAt: string | null;
}

/** Onboarding 基本資料 */
export interface Profile {
  nickname: string;
  city: string;
  /** 有空的星期 */
  freeDays: string[];
  /** 常見有空時段 */
  freeSlots: string[];
  /** 是否完成 onboarding */
  onboarded: boolean;
}

/** AI 規劃後的單一站點 */
export interface PlannedStop {
  placeId: string;
  name: string;
  meta: string;
  dist: number;
  lat: number;
  lng: number;
}

/** AI 規劃路線結果（spec 2.5） */
export interface PlannedRoute {
  stops: PlannedStop[];
  totalDist: number;
  totalTime: number;
  totalCost: number;
  /** 規劃當下使用的出發點：GPS 成功＝真實座標；失敗＝fallback（台南市東區） */
  origin: Coord;
}

/** 完成行程的分支（spec 2.6） */
export type FinishType = 'ride' | 'dining';

/** 確認頁要呈現的內容（spec 2.6 / 2.7 / 2.8） */
export interface Confirmation {
  /** ride / dining 走任務獎勵；quick 為單純叫車不觸發獎勵 */
  kind: FinishType | 'quick';
  title: string;
  context: string;
  /** 是否顯示任務獎勵卡片（徽章 + 地圖點亮） */
  reward: boolean;
  badge?: { icon: string; name: string; note: string };
  litArea?: string;
}

/** 每日推薦任務（spec 2.3 任務一） */
export interface DailyTask {
  window: string;
  category: string;
  description: string;
  status: 'active' | 'done';
}
