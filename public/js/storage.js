/**
 * localStorage 存档层
 * 所有进度本地保存，不使用 OAuth，不上传用户数据。
 */

const KEY = 'kanshan-evolution-save-v1';

export const DEFAULT_STATE = {
  version: 1,
  adopted: false,
  nickname: '',
  petName: '',
  adoptedAt: null,

  attrs: { tech: 0, art: 0, work: 0, emotion: 0, life: 0, history: 0 },
  affinity: 0,
  reachedStage: 'stranger',

  currentForm: 'origin',
  unlockedForms: ['origin'],
  souvenirs: [],

  memories: [],        // 记忆碎片：用户提过的关键词
  domainCounts: {},    // 常读领域
  recentAnswers: [],   // 最近读过的回答（供知识类泡泡与人格上下文）
  recentOutings: [],   // 最近三次外出见闻
  chatSummary: [],     // 最近对话摘要

  npcVisit: null,      // { id, until }
  metNpcs: [],

  lastInteractAt: null,
  lastChatAt: null,
  lastLoginDate: null,
  loginStreak: 0,

  outing: null,        // { startAt, returnAt, note, claimed }
  demoMode: false,
  reducedMotion: false,

  // ---- 功能开关（用户可关闭，需求 3）----
  features: {
    outingChat: true,    // 见闻后与它深入交流
    eyeCare: true,       // 护眼提醒（抖动 + 提示）
    callWhenAway: true,  // 外出期间可以联系它
    floatingMode: false  // 桌宠悬浮窗（默认关闭，需在设置里主动开启）
  },

  eyeCare: { sessionStart: null, lastRemindAt: null },

  /** 桌宠安装横幅是否已被用户关闭（需求 3） */
  installDismissed: false,

  /** 开关默认值迁移标记，避免对已迁移存档重复纠正 */
  featuresMigratedV2: true,

  dailyCaps: { date: '', minigame: 0, outing: 0, chatRounds: 0 }
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    // 与默认值做浅合并，保证旧存档兼容新字段
    const merged = { ...clone(DEFAULT_STATE), ...parsed };
    merged.attrs = { ...DEFAULT_STATE.attrs, ...(parsed.attrs || {}) };
    merged.dailyCaps = { ...DEFAULT_STATE.dailyCaps, ...(parsed.dailyCaps || {}) };
    // 嵌套对象需单独合并，否则旧存档会缺少新增的开关项
    merged.features = { ...DEFAULT_STATE.features, ...(parsed.features || {}) };
    merged.eyeCare = { ...DEFAULT_STATE.eyeCare, ...(parsed.eyeCare || {}) };

    // 迁移：早期版本曾把桌宠悬浮窗默认设为开启，导致主应用一进来就贴在右侧。
    // 对尚未手动调整过该开关的旧存档做一次性纠正。
    if (!parsed.featuresMigratedV2) {
      merged.features.floatingMode = false;
      merged.featuresMigratedV2 = true;
    }

    return merged;
  } catch {
    return clone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function resetState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return clone(DEFAULT_STATE);
}

/** 每日上限按自然日重置 */
export function ensureDaily(state) {
  const today = new Date().toISOString().slice(0, 10);
  if (state.dailyCaps.date !== today) {
    state.dailyCaps = { date: today, minigame: 0, outing: 0, chatRounds: 0 };
  }
  return state;
}
