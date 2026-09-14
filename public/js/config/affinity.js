/**
 * 好感度系统配置
 * 五个阶段，每个阶段都必须改变说话方式（称呼 + 语气 + 句长）。
 */

export const AFFINITY_STAGES = [
  {
    key: 'stranger',
    name: '陌生',
    min: 0,
    max: 99,
    address: '那个人类',
    tone: '短、冷淡、有距离感。一次不超过两句，很少主动提问。',
    toneTag: '疏离',
    unlocks: ['基础对话', '每日问候'],
    color: '#9aa7b4'
  },
  {
    key: 'familiar',
    name: '眼熟',
    min: 100,
    max: 299,
    address: '你',
    tone: '开始主动搭话，偶尔反问，但还不会说自己的事。',
    toneTag: '试探',
    unlocks: ['外出系统', '轻互动小游戏'],
    color: '#7fa8c9'
  },
  {
    key: 'close',
    name: '熟络',
    min: 300,
    max: 599,
    address: '{nickname}',
    tone: '会讲自己的事，提到朋友和外出见闻，语气松弛下来。',
    toneTag: '松弛',
    unlocks: ['外出社交', 'NPC 登门', '专属表情包'],
    color: '#6fb89a'
  },
  {
    key: 'attached',
    name: '依赖',
    min: 600,
    max: 999,
    address: '我的人类',
    tone: '更软、更长，会暴露脆弱面，会说“你今天怎么才回来”。',
    toneTag: '黏人',
    unlocks: ['深夜模式', '记忆回溯', '限定装扮'],
    color: '#e2909c'
  },
  {
    key: 'bond',
    name: '羁绊',
    min: 1000,
    max: Infinity,
    address: '{petname}',
    tone: '不再客套，直接说“我在”。笃定、亲密、偶尔撒娇。',
    toneTag: '笃定',
    unlocks: ['羁绊形态', '年度纪念册', '分享海报'],
    color: '#ff9ec4'
  }
];

/** 好感度获取规则与每日上限 */
export const AFFINITY_RULES = {
  read: { amount: 3, dailyCap: Infinity, label: '读完一篇回答' },
  minigame: { min: 5, max: 15, dailyCap: 30, label: '完成一次小游戏' },
  outing: { amount: 20, dailyCap: 40, label: '听完外出见闻并回应' },
  chat: { amount: 2, dailyCap: 20, unit: 'rounds', label: '有效自由对话' },
  streak: { perDay: 5, max: 30, label: '连续登录' }
};

/** 衰减：三天未登录后每天 -10，但阶段永不回退 */
export const DECAY_RULE = {
  graceDays: 3,
  perDay: 10
};

export function getStage(affinity) {
  const v = Number(affinity) || 0;
  for (let i = AFFINITY_STAGES.length - 1; i >= 0; i--) {
    if (v >= AFFINITY_STAGES[i].min) return AFFINITY_STAGES[i];
  }
  return AFFINITY_STAGES[0];
}

export function getStageByKey(key) {
  return AFFINITY_STAGES.find((s) => s.key === key) || AFFINITY_STAGES[0];
}

/** 阶段永不回退：取历史最高阶段与当前数值阶段的较高者 */
export function getEffectiveStage(affinity, reachedStageKey) {
  const current = getStage(affinity);
  if (!reachedStageKey) return current;
  const reached = getStageByKey(reachedStageKey);
  const ci = AFFINITY_STAGES.indexOf(current);
  const ri = AFFINITY_STAGES.indexOf(reached);
  return ri > ci ? reached : current;
}

/** 生成当前称呼 */
export function resolveAddress(stage, nickname, petName) {
  return stage.address
    .replace('{nickname}', nickname || '你')
    .replace('{petname}', petName || nickname || '你');
}

/** 羁绊阶段的 AI 专属爱称候选（本地兜底，live 模式可由直答生成） */
export const PET_NAMES = ['小暖灯', '我的屋顶', '毛线球', '晚风', '同屋的你'];

/** 关系类泡泡占比随好感度提升，依赖阶段过半 */
export const BUBBLE_MIX = {
  stranger: { mood: 0.7, knowledge: 0.25, relation: 0.05 },
  familiar: { mood: 0.5, knowledge: 0.3, relation: 0.2 },
  close: { mood: 0.35, knowledge: 0.3, relation: 0.35 },
  attached: { mood: 0.2, knowledge: 0.25, relation: 0.55 },
  bond: { mood: 0.15, knowledge: 0.2, relation: 0.65 }
};
