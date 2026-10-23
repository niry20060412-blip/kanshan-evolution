/**
 * 前端 API 客户端
 * 所有请求都有超时与失败兜底，绝不向界面抛出堆栈。
 * 前端不持有任何密钥。
 *
 * 兜底策略：请求拿不到数据时，阅读页直接用内置知识卡（local-knowledge.js），
 * 保证「选领域 → 读一篇 → 属性成长」这条主循环在纯静态部署下也不会断。
 */

import { LOCAL_HOT, pickLocalAnswer } from './local-knowledge.js';

const TIMEOUT_MS = 9000;

/** 上一次发出的本地卡片标题，避免「换一篇」换到同一篇 */
let lastLocalTitle = '';

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return { ok: false, reason: 'HTTP', data: null };
    return await res.json();
  } catch {
    return { ok: false, reason: 'NETWORK', data: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealth() {
  return request('/api/health');
}

/** 获取某领域的一篇回答；失败时回退内置知识卡，保证阅读页不空着 */
export async function fetchAnswer(domainKey) {
  const res = await request(`/api/knowledge/search?domain=${encodeURIComponent(domainKey)}`);
  if (res && res.ok && res.data) return res;

  const card = pickLocalAnswer(domainKey, lastLocalTitle);
  if (!card) return { ok: false, reason: 'NO_LOCAL_DATA', data: null };
  lastLocalTitle = card.title;
  return { ok: true, data: card, source: 'local-example' };
}

export async function fetchHot() {
  const res = await request('/api/hot');
  if (res && res.ok && Array.isArray(res.data) && res.data.length) return res;
  return { ok: true, data: LOCAL_HOT, source: 'local-example' };
}

/** 见闻改写；失败返回 ok:false，调用方回退本地语料 */
export async function rewriteOuting(text, formName, nickname) {
  return request('/api/answer/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, formName, nickname })
  });
}

/** 自由对话；system prompt 由人格层拼装后传入 */
export async function sendDialogue(system, message) {
  return request('/api/dialogue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, message })
  });
}

/**
 * 通过看山工作台本地 API 发送对话请求
 * 看山工作台在 localhost:3200 提供 /v1/chat/completions 兼容接口
 */
export async function sendDialogueViaKanshan(system, message) {
  return request('/api/dialogue/kanshan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, message })
  });
}
