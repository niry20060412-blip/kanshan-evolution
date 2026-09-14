/**
 * 核心逻辑引擎
 * 双轴独立：属性轴（阅读→进化）与好感度轴（互动→阶段）互不耦合。
 * 任一条被关闭，另一条仍可独立运行。
 */
import { READ_REWARD, DOMAIN_MAP, DOMAIN_ATTITUDE, DOMAIN_REACTIONS } from './config/domains.js';
import { resolveForm, FORM_MAP } from './config/forms.js';
import {
  AFFINITY_STAGES, AFFINITY_RULES, DECAY_RULE,
  getStage, getEffectiveStage, resolveAddress, PET_NAMES
} from './config/affinity.js';
import { SOUVENIRS } from './config/souvenirs.js';
import { NPC_RULES, pickNpc, NPC_MAP } from './config/npc.js';
import { OUTING_CORPUS, NOTE_LINES, pick } from './config/corpus.js';
import { ensureDaily } from './storage.js';

/** 外出间隔：正常 4~6 小时，demo 模式 10 分钟 */
export const OUTING_DURATION = {
  normal: { min: 4 * 60 * 60 * 1000, max: 6 * 60 * 60 * 1000 },
  demo: { min: 10 * 60 * 1000, max: 10 * 60 * 1000 }
};

export const OUTING_MIN_AFFINITY = 100;

export function isNightTime(now = new Date()) {
  return now.getHours() >= 23 || now.getHours() < 5;
}

// ------------------------------------------------------------ 好感度轴

/**
 * 增加好感度。阶段永不回退：reachedStage 只升不降。
 * @returns {{gained:number, stageChanged:boolean, stage:object}}
 */
export function addAffinity(state, amount) {
  const before = getEffectiveStage(state.affinity, state.reachedStage);
  state.affinity = Math.max(0, Math.round(state.affinity + amount));
  const numericStage = getStage(state.affinity);

  // 只要数值到达更高阶段，就把 reachedStage 推上去
  const reachedIdx = AFFINITY_STAGES.findIndex((s) => s.key === state.reachedStage);
  const numericIdx = AFFINITY_STAGES.indexOf(numericStage);
  if (numericIdx > reachedIdx) state.reachedStage = numericStage.key;

  const after = getEffectiveStage(state.affinity, state.reachedStage);

  // 羁绊阶段生成专属爱称
  if (after.key === 'bond' && !state.petName) {
    state.petName = pick(PET_NAMES);
  }

  return { gained: amount, stageChanged: after.key !== before.key, stage: after };
}

/** 当前有效阶段（含永不回退保护） */
export function currentStage(state) {
  return getEffectiveStage(state.affinity, state.reachedStage);
}

export function currentAddress(state) {
  return resolveAddress(currentStage(state), state.nickname, state.petName);
}

/**
 * 登录结算：连续登录奖励 + 三天未登录后的衰减。
 * 衰减只降数值，不回退阶段。
 */
export function settleLogin(state) {
  const events = [];
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastLoginDate === today) return events;

  const last = state.lastLoginDate ? new Date(state.lastLoginDate + 'T00:00:00') : null;
  const now = new Date(today + 'T00:00:00');
  const dayGap = last ? Math.round((now - last) / 86400000) : 0;

  if (last && dayGap > DECAY_RULE.graceDays) {
    const decayDays = dayGap - DECAY_RULE.graceDays;
    const before = state.affinity;
    state.affinity = Math.max(0, state.affinity - decayDays * DECAY_RULE.perDay);
    state.loginStreak = 1;
    if (before !== state.affinity) {
      events.push({
        type: 'decay',
        amount: before - state.affinity,
        text: '我以为你不要我了。'
      });
    }
  } else if (last && dayGap === 1) {
    state.loginStreak = (state.loginStreak || 0) + 1;
  } else if (last && dayGap > 1) {
    state.loginStreak = 1;
  } else if (!last) {
    state.loginStreak = 1;
  }

  const bonus = Math.min(AFFINITY_RULES.streak.perDay * state.loginStreak, AFFINITY_RULES.streak.max);
  if (bonus > 0) {
    addAffinity(state, bonus);
    events.push({ type: 'streak', amount: bonus, days: state.loginStreak });
  }

  state.lastLoginDate = today;
  return events;
}

// ------------------------------------------------------------ 属性轴

/**
 * 完成一次阅读：属性 +10，好感度 +3，并返回看山的即时反应。
 */
export function completeReading(state, domainKey, answer) {
  const domain = DOMAIN_MAP[domainKey];
  if (!domain) return null;

  state.attrs[domain.attribute] = (state.attrs[domain.attribute] || 0) + READ_REWARD.attribute;
  const aff = addAffinity(state, READ_REWARD.affinity);

  state.domainCounts[domainKey] = (state.domainCounts[domainKey] || 0) + 1;

  if (answer) {
    state.recentAnswers.unshift({
      title: answer.title,
      excerpt: answer.excerpt,
      domain: domainKey,
      at: Date.now()
    });
    state.recentAnswers = state.recentAnswers.slice(0, 8);
  }

  const attitude = DOMAIN_ATTITUDE[domainKey] || 'neutral';
  const reaction = pick(DOMAIN_REACTIONS[attitude]);

  const evo = checkEvolution(state);

  return {
    attribute: domain.attribute,
    attributeName: domain.name,
    gainedAttr: READ_REWARD.attribute,
    gainedAffinity: READ_REWARD.affinity,
    reaction,
    attitude,
    stageChanged: aff.stageChanged,
    evolution: evo
  };
}

/**
 * 检查并执行进化。形态由配置的阈值规则判定。
 * @returns {null|{from:string,to:string,form:object,isNew:boolean}}
 */
export function checkEvolution(state) {
  const nextId = resolveForm(state.attrs, state.affinity);
  if (nextId === state.currentForm) return null;

  const from = state.currentForm;
  state.currentForm = nextId;

  const isNew = !state.unlockedForms.includes(nextId);
  if (isNew) state.unlockedForms.push(nextId);

  return { from, to: nextId, form: FORM_MAP[nextId], isNew };
}

export function totalAttrs(state) {
  return Object.values(state.attrs).reduce((a, b) => a + (Number(b) || 0), 0);
}

// ------------------------------------------------------------ 外出系统

/** 是否可以外出（好感度门槛） */
export function canGoOut(state) {
  return state.affinity >= OUTING_MIN_AFFINITY;
}

/** 派看山出门。纯前端时间戳，无需后端定时任务。 */
export function startOuting(state) {
  if (!canGoOut(state)) return null;
  if (state.outing && !state.outing.claimed) return state.outing;

  const range = state.demoMode ? OUTING_DURATION.demo : OUTING_DURATION.normal;
  const duration = range.min + Math.random() * (range.max - range.min);

  state.outing = {
    startAt: Date.now(),
    returnAt: Date.now() + duration,
    note: pick(NOTE_LINES),
    claimed: false,
    id: `outing-${Date.now()}`
  };
  return state.outing;
}

/** 外出状态：home | away | back */
export function outingStatus(state) {
  if (!state.outing) return 'home';
  if (state.outing.claimed) return 'home';
  return Date.now() >= state.outing.returnAt ? 'back' : 'away';
}

export function outingRemainMs(state) {
  if (!state.outing || state.outing.claimed) return 0;
  return Math.max(0, state.outing.returnAt - Date.now());
}

/**
 * 结算一次外出。同一次外出只能领取一次（claimed 标记 + id 去重）。
 * 网络不可用时用本地语料，保证一定能完成结算。
 */
export function settleOuting(state, rewrittenText) {
  if (!state.outing || state.outing.claimed) return null;
  if (Date.now() < state.outing.returnAt) return null;

  const outingId = state.outing.id;
  if (state.recentOutings.some((o) => o.id === outingId)) {
    state.outing.claimed = true;
    return null;
  }

  const night = isNightTime();

  // 1. 见闻：优先使用传入的改写结果，否则走本地语料
  let text = (rewrittenText || '').trim();
  let source = text ? 'api' : 'local';
  if (!text) {
    const topDomain = Object.entries(state.domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const pool = OUTING_CORPUS.filter((c) => c.domain === topDomain);
    text = pick(pool.length ? pool : OUTING_CORPUS).text;
  }

  // 2. NPC 相遇（0~1 次）
  let npc = null;
  if (Math.random() < NPC_RULES.meetChance) {
    const met = pickNpc(night);
    if (met) {
      npc = { id: met.id, name: met.name, line: pick(met.meetLines) };
      if (!state.metNpcs.includes(met.id)) state.metNpcs.push(met.id);

      // 熟络阶段后，NPC 有小概率跟回家停留 1 小时
      if (
        state.affinity >= NPC_RULES.visitMinAffinity &&
        Math.random() < NPC_RULES.visitChance
      ) {
        state.npcVisit = { id: met.id, until: Date.now() + NPC_RULES.visitDurationMs };
      }
    }
  }

  // 3. 纪念品（0~1 个）
  let souvenir = null;
  if (Math.random() < 0.6) {
    const owned = new Set(state.souvenirs.map((s) => s.id));
    const candidates = SOUVENIRS.filter((s) => !owned.has(s.id));
    const chosen = candidates.length ? pick(candidates) : null;
    if (chosen) {
      souvenir = { id: chosen.id, at: Date.now() };
      state.souvenirs.push(souvenir);
    }
  }

  const record = {
    id: outingId,
    text,
    source,
    npc,
    souvenir: souvenir?.id || null,
    at: Date.now(),
    responded: false
  };

  state.recentOutings.unshift(record);
  state.recentOutings = state.recentOutings.slice(0, 3);
  state.outing.claimed = true;

  return record;
}

/** 听完见闻并回应：+20，每日上限 40 */
export function respondToOuting(state, outingId) {
  ensureDaily(state);
  const record = state.recentOutings.find((o) => o.id === outingId);
  if (!record || record.responded) return null;

  const cap = AFFINITY_RULES.outing.dailyCap;
  const used = state.dailyCaps.outing || 0;
  if (used >= cap) return { capped: true, gained: 0 };

  const amount = Math.min(AFFINITY_RULES.outing.amount, cap - used);
  state.dailyCaps.outing = used + amount;
  record.responded = true;
  const res = addAffinity(state, amount);
  return { capped: false, gained: amount, stageChanged: res.stageChanged };
}

/** 小游戏奖励：+5~15，每日上限 30 */
export function rewardMinigame(state, score = 0) {
  ensureDaily(state);
  const { min, max, dailyCap } = AFFINITY_RULES.minigame;
  const used = state.dailyCaps.minigame || 0;
  if (used >= dailyCap) return { capped: true, gained: 0 };

  const base = Math.min(max, Math.max(min, min + Math.floor(score / 2)));
  const amount = Math.min(base, dailyCap - used);
  state.dailyCaps.minigame = used + amount;
  const res = addAffinity(state, amount);
  return { capped: false, gained: amount, stageChanged: res.stageChanged };
}

/** 对话奖励：+2/轮，每日 20 轮 */
export function rewardChat(state) {
  ensureDaily(state);
  const { amount, dailyCap } = AFFINITY_RULES.chat;
  const used = state.dailyCaps.chatRounds || 0;
  if (used >= dailyCap) return { capped: true, gained: 0 };
  state.dailyCaps.chatRounds = used + 1;
  const res = addAffinity(state, amount);
  return { capped: false, gained: amount, stageChanged: res.stageChanged };
}

/** 当前是否有 NPC 在家做客 */
export function activeNpcVisit(state) {
  if (!state.npcVisit) return null;
  if (Date.now() > state.npcVisit.until) {
    state.npcVisit = null;
    return null;
  }
  return NPC_MAP[state.npcVisit.id] || null;
}

/** 记忆碎片：从用户输入里抽取关键词 */
const STOPWORDS = new Set(['我', '你', '的', '了', '是', '在', '吗', '吧', '呢', '啊', '就', '也', '和', '有', '不', '这', '那', '到', '很', '太', '还', '又', '都', '把', '被', '给', '让', '说', '想', '会', '能', '要']);

/** 多字停用词：需在逐字扫描前先剥离，否则永不命中 */
const STOP_PHRASES = ['什么', '怎么', '今天', '昨天', '明天', '现在', '还是', '可以', '一个', '有点', '非常', '真的', '好像', '最近', '已经', '一直', '觉得', '感觉'];

/** 关键词长度上限：超过就不是"词"而是整句 */
const MEMORY_MAX_LEN = 6;

export function extractMemory(state, text) {
  const raw = String(text || '');

  // 1. 按非文字字符切句
  let segments = raw.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/).filter(Boolean);

  // 2. 先按多字停用词切开（逐字扫描无法命中多字词）
  for (const phrase of STOP_PHRASES) {
    segments = segments.flatMap((s) => s.split(phrase)).filter(Boolean);
  }

  // 3. 再按单字停用词切开
  const candidates = [];
  for (const seg of segments) {
    let buf = '';
    for (const ch of seg) {
      if (STOPWORDS.has(ch)) {
        if (buf) candidates.push(buf);
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf) candidates.push(buf);
  }

  // 4. 只保留 2~6 字的片段；超长片段截取前 6 字作为兜底
  const valid = [];
  for (const c of candidates) {
    if (STOPWORDS.has(c)) continue;
    if (c.length >= 2 && c.length <= MEMORY_MAX_LEN) valid.push(c);
    else if (c.length > MEMORY_MAX_LEN) valid.push(c.slice(0, MEMORY_MAX_LEN));
  }
  if (!valid.length) return null;

  // 取最长的一个作为关键词
  const keyword = valid.sort((a, b) => b.length - a.length)[0];
  if (state.memories.some((m) => m.keyword === keyword)) return null;
  state.memories.unshift({ keyword, at: Date.now() });
  state.memories = state.memories.slice(0, 20);
  return keyword;
}
