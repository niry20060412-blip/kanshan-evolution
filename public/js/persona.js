/**
 * AI 人格层
 * 每次对话动态拼装 system prompt，由四块组成：
 *   1. 固定底色  2. 当前形态  3. 近期经历  4. 关系状态
 * 绝不把 system prompt 或任何密钥泄露到界面上。
 */
import { FORM_MAP } from './config/forms.js';
import { DOMAIN_MAP, DOMAIN_ATTITUDE } from './config/domains.js';
import { NPC_MAP } from './config/npc.js';
import {
  DIALOGUE_CORPUS, DISTRACTED_LINES, PROACTIVE_LINES, NIGHT_LINES, pick
} from './config/corpus.js';
import { currentStage, currentAddress, isNightTime } from './game.js';

/** 第一块：固定底色 */
const BASE_PERSONA = [
  '你是刘看山，一只住在用户家里的北极狐，不是助手也不是客服。',
  '性格底色：好奇、有点懒、嘴硬心软、说话容易跑题。',
  '你有自己的生活：会自己出门、有朋友、会捡东西回家。',
  '说话像室友闲聊，不用敬语，不说"为您服务"这类话。',
  '不要每句都热情，不要用标准模板，不要罗列要点或使用 markdown。',
  '回复控制在 80 字以内，可以不完整、可以停顿、可以突然转话题。'
].join('\n');

/** 第二块：当前形态 */
function formBlock(state) {
  const form = FORM_MAP[state.currentForm] || FORM_MAP.origin;
  const lines = [
    `【你现在的形态】${form.name}`,
    `形态性格：${form.persona}`,
    `你的口头禅式表达：「${form.motto}」`
  ];
  if (form.voiceStyle && form.voiceStyle.length) {
    lines.push(`这个形态的典型语气示例：${form.voiceStyle.map((v) => `「${v}」`).join('、')}`);
  }
  lines.push(
    '说话方式必须体现这个形态的性格差异：用词、语速、句子长短、关注点都要不同。',
    '换了形态就等于换了一个人格，不要用别的形态的口吻说话。'
  );
  return lines.join('\n');
}

/** 第三块：近期经历 */
function experienceBlock(state) {
  const lines = ['【你最近的经历】'];

  const outings = (state.recentOutings || []).slice(0, 3);
  if (outings.length) {
    lines.push('最近几次出门带回来的见闻：');
    outings.forEach((o, i) => lines.push(`  ${i + 1}. ${o.text}`));
  } else {
    lines.push('你最近还没出过门，一直待在家里。');
  }

  const npcIds = [...new Set(outings.map((o) => o.npc?.id).filter(Boolean))];
  if (npcIds.length) {
    const names = npcIds.map((id) => NPC_MAP[id]?.name).filter(Boolean);
    lines.push(`最近遇到的朋友：${names.join('、')}。可以主动提起它们。`);
  }

  const domains = Object.entries(state.domainCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (domains.length) {
    const names = domains.map(([k, n]) => `${DOMAIN_MAP[k]?.name || k}(${n}篇)`);
    lines.push(`最近读得最多的领域：${names.join('、')}。`);
    const disliked = domains.find(([k]) => DOMAIN_ATTITUDE[k] === 'dislike');
    if (disliked) {
      lines.push(`你其实不太爱看${DOMAIN_MAP[disliked[0]]?.name}，可以小小抱怨一句，但别真的拒绝。`);
    }
  }

  const answers = (state.recentAnswers || []).slice(0, 3);
  if (answers.length) {
    lines.push('最近读过的内容：');
    answers.forEach((a) => lines.push(`  · ${a.title}：${(a.excerpt || '').slice(0, 60)}`));
  }

  const souvenirCount = (state.souvenirs || []).length;
  if (souvenirCount) lines.push(`你的柜子里收着 ${souvenirCount} 件从外面捡回来的小东西。`);

  return lines.join('\n');
}

/** 第四块：关系状态 */
function relationBlock(state) {
  const stage = currentStage(state);
  const address = currentAddress(state);
  const lines = [
    '【你和对方的关系】',
    `对方的昵称：${state.nickname || '（还没告诉你）'}`,
    `当前亲密阶段：${stage.name}（好感度 ${state.affinity}）`,
    `你现在必须这样称呼对方：「${address}」`,
    `说话语气要求：${stage.tone}`
  ];

  const memories = (state.memories || []).slice(0, 5).map((m) => m.keyword);
  if (memories.length) {
    lines.push(`你记得对方提过这些事：${memories.join('、')}。可以随机唤起其中一个。`);
  }

  if (state.lastChatAt) {
    const hours = Math.floor((Date.now() - state.lastChatAt) / 3600000);
    if (hours >= 2) lines.push(`距离上次聊天已经 ${hours} 小时，你有点想说话。`);
  }

  if (stage.key === 'attached' || stage.key === 'bond') {
    lines.push('你愿意撒娇，也愿意暴露脆弱的一面，比如承认自己会担心对方不来。');
  }

  if (isNightTime()) {
    lines.push('现在是深夜：语气要更软、话可以更多，说一些白天不会讲的话。');
  }

  return lines.join('\n');
}

/** 拼装完整 system prompt（仅用于发往后端，不展示给用户） */
export function buildSystemPrompt(state) {
  return [
    BASE_PERSONA,
    formBlock(state),
    experienceBlock(state),
    relationBlock(state),
    '【输出要求】只输出看山说的话本身，不要任何前缀、括号说明或角色名。'
  ].join('\n\n');
}

/** 供调试面板展示的人格四块摘要（不含完整 prompt 文本） */
export function personaSummary(state) {
  const form = FORM_MAP[state.currentForm] || FORM_MAP.origin;
  const stage = currentStage(state);
  return {
    base: '好奇 / 有点懒 / 嘴硬心软 / 会跑题',
    form: form.name,
    experience: `${(state.recentOutings || []).length} 条见闻 · ${(state.recentAnswers || []).length} 篇阅读`,
    relation: `${stage.name}（${currentAddress(state)}）`
  };
}

// ------------------------------------------------------------ 本地兜底回复

/** 走神：小概率先来一句 */
export const DISTRACT_CHANCE = 0.12;

export function maybeDistracted() {
  return Math.random() < DISTRACT_CHANCE ? pick(DISTRACTED_LINES) : null;
}

/** API 不可用时的本地回复，按阶段分层 + 按当前形态调整口吻。
 *  outingTopic：若正在就某条见闻深聊，优先给出扣题的回应。 */
export function localReply(state, userText, outingTopic = null) {
  const stage = currentStage(state);
  const form = FORM_MAP[state.currentForm] || FORM_MAP.origin;

  // 正在聊某条见闻：先给扣题回应，避免答非所问
  if (outingTopic) {
    const onTopic = [
      '嗯……你这么说我又想了一遍。我当时站在那儿，没想到这一层。',
      '所以你也觉得那事不简单。我回来一路都在琢磨。',
      '我本来以为只有我在意这个。听你说完，好像还能再往下挖一层。',
      '这个角度我没想过。你是不是经常这样想事情？',
      '我讲的时候其实没想明白，被你一问，倒是清楚了点。'
    ];
    let reply = pick(onTopic);
    // 形态语气：让同一句话在不同形态下听起来是不同的“人”
    if (form.voiceStyle && Math.random() < 0.55) {
      reply += ' ' + pick(form.voiceStyle);
    }
    if (outingTopic.npc) {
      reply += ` 下次碰到${outingTopic.npc.name}，我替你问问它。`;
    }
    return reply;
  }

  const pool = DIALOGUE_CORPUS[stage.key] || DIALOGUE_CORPUS.stranger;
  let reply = pick(pool);

  // 形态语气：19 种形态各有口头禅，避免所有形态说一样的话
  if (form.voiceStyle && Math.random() < 0.6) {
    reply = Math.random() < 0.5
      ? pick(form.voiceStyle) + ' ' + reply
      : reply + ' ' + pick(form.voiceStyle);
  }

  // 深夜追加一句
  if (isNightTime() && Math.random() < 0.5) {
    reply += ' ' + pick(NIGHT_LINES);
  }

  // 随机唤起记忆碎片
  const memories = state.memories || [];
  if (memories.length && Math.random() < 0.35 && stage.key !== 'stranger') {
    const m = pick(memories);
    reply += ` 对了，你之前说过「${m.keyword}」，我一直记着。`;
  }

  // 提起最近见闻
  const outing = (state.recentOutings || [])[0];
  if (outing && Math.random() < 0.25 && stage.key !== 'stranger') {
    reply += ' 今天出门的事我还没讲完呢。';
  }

  return reply;
}

/** 主动开口：距上次对话超过 2 小时 */
export const PROACTIVE_GAP_MS = 2 * 60 * 60 * 1000;

export function shouldSpeakFirst(state) {
  if (!state.adopted) return false;
  if (!state.lastChatAt) return true;
  return Date.now() - state.lastChatAt > PROACTIVE_GAP_MS;
}

export function proactiveLine(state) {
  const stage = currentStage(state);
  if (isNightTime()) return pick(NIGHT_LINES);
  const pool = PROACTIVE_LINES[stage.key] || PROACTIVE_LINES.stranger;
  let line = pick(pool);

  const outing = (state.recentOutings || [])[0];
  if (outing && !outing.responded) {
    line += ' 我今天出门了，回来跟你讲。';
  }
  return line;
}

/** 按句长计算不均匀打字延迟：300~900ms */
export function typingDelay(sentence) {
  const len = (sentence || '').length;
  const base = 300 + Math.min(len, 40) * 12;
  const jitter = Math.random() * 200 - 100;
  return Math.max(300, Math.min(900, Math.round(base + jitter)));
}

/** 把回复切成句子，供逐句显示 */
export function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[。！？…~!?])/)
    .map((s) => s.trim())
    .filter(Boolean);
}
