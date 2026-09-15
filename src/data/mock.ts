import type { DailyTask, Place, Profile, QuizAnswer } from '../types';

// ── 台南市東區座標（原型寫死的假 GPS）。
// 使用者目前位置現在走真實 Geolocation（見 hooks/useGeolocation.ts）；
// 這組座標只在「定位失敗 / 被拒絕 / 不支援」時當 fallback 用。
export const MOCK_GPS = { lat: 22.9838, lng: 120.2231, label: '台南市東區' };

export const DEFAULT_PROFILE: Profile = {
  nickname: '',
  city: '',
  freeDays: ['三', '四', '六', '日'],
  freeSlots: ['晚上下班後', '週末整天'],
  onboarded: false,
};

export const DEFAULT_QUIZ: QuizAnswer = {
  mood: '😊 開心',
  direction: '🌊 海',
  score: 6,
  answeredAt: null,
};

export const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
export const TIME_SLOTS = ['晚上下班後', '午休', '週末整天'];

export const MOODS = ['😊 開心', '😐 普通', '😪 疲憊', '😤 苦悶'];
export const DIRECTIONS = ['🏞 山', '🌊 海', '🏙 城市', '🏘 巷弄裡'];

// ── 收藏地點（spec 第 4 節：正式版由 VLM/OCR 辨識 + geocoding 產生）
export const MOCK_PLACES: Place[] = [
  {
    id: 'p1',
    name: '林檎二訪咖啡',
    region: '台南市中西區',
    category: '咖啡廳',
    source: 'Instagram 截圖',
    lat: 22.9973,
    lng: 120.1957,
    visited: false,
  },
  {
    id: 'p2',
    name: '小巷裡的選物店',
    region: '台北市',
    category: '選物 / 逛街',
    source: 'Google Maps 截圖',
    lat: 25.033,
    lng: 121.5654,
    visited: false,
  },
  {
    id: 'p3',
    name: '深夜燒肉專門店',
    region: '台中市西區',
    category: '餐廳',
    source: 'Facebook 貼文截圖',
    lat: 24.1477,
    lng: 120.6736,
    visited: false,
    seasonal: { icon: '🍁', name: '秋日燒肉限定', season: '秋季限定', unlocked: false },
  },
  {
    id: 'p4',
    name: '土道剉冰',
    region: '台南市東區',
    category: '甜品 / 剉冰',
    source: 'Instagram 截圖',
    lat: 22.9871,
    lng: 120.2215,
    visited: true,
    seasonal: { icon: '🍧', name: '夏至剉冰限定', season: '夏至限定', unlocked: true },
  },
  {
    id: 'p5',
    name: '巴克禮公園賞花小徑',
    region: '台南市東區',
    category: '戶外 / 走走',
    source: 'Instagram 截圖',
    lat: 22.9756,
    lng: 120.2278,
    visited: true,
    seasonal: { icon: '🌸', name: '春分賞花限定', season: '春分限定', unlocked: true },
  },
];

// 依偏好推薦（spec 2.5 segment「依偏好推薦」）已改真實資料：
// 見 src/lib/recommendations.ts + gas/Code.gs 的 handleRecommendPlaces_
// （真實 GPS + Overpass API 查附近地點，不再用這裡的寫死清單）。

// ── 徽章牆（spec 2.3 任務二：節氣・季節限定，共 6 枚）
export const MOCK_BADGES = [
  { icon: '🌸', name: '春分・賞花', unlocked: true },
  { icon: '🍧', name: '夏至・剉冰', unlocked: true },
  { icon: '🍁', name: '秋季・燒肉', unlocked: false },
  { icon: '❄️', name: '冬至・湯圓', unlocked: false },
  { icon: '🎋', name: '七夕・限定', unlocked: false },
  { icon: '🎆', name: '跨年・限定', unlocked: false },
];

// ── 今日推薦任務（spec 2.3 任務一：正式版依有空時段動態推播）
export const MOCK_DAILY_TASK: DailyTask = {
  window: '11:00–15:00',
  category: '咖啡廳',
  description: '完成一趟「咖啡廳」行程，就能點亮地圖上的新角落。',
  status: 'active',
};

// ── 單純叫車的快速選擇（spec 2.7）
export const QUICK_DESTINATIONS = [
  { label: '🏠 家', value: '家（台南市東區）' },
  { label: '💼 公司', value: '公司（台南市中西區）' },
  { label: '🚉 台南火車站', value: '台南火車站' },
  { label: '☕ 最近收藏地點', value: '林檎二訪咖啡' },
];
