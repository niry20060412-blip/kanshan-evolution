/**
 * 知乎开放平台客户端
 * 密钥只在此处使用，永不出现在响应体中。
 * 任何失败都向上抛出，由路由层降级到本地语料。
 */
import { CONFIG, getSecret } from './config.js';

async function request(pathname, { method = 'GET', query, body } = {}) {
  const secret = getSecret();
  if (!secret) throw new Error('NO_SECRET');

  const url = new URL(CONFIG.API_BASE + pathname);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const json = await res.json();
    if (json && typeof json.Code === 'number' && json.Code !== 0) {
      throw new Error(`API_${json.Code}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** 搜索知乎内容 */
export async function searchZhihu(query, count = 5) {
  const json = await request('/search/zhihu', { query: { Query: query, Count: count } });
  const items = json?.Data?.Items || json?.Data || [];
  return items.map((it) => ({
    title: it.Title || it.title || '',
    author: it.AuthorName || it.author || '知乎用户',
    voteCount: Number(it.VoteCount || it.voteCount || 0),
    excerpt: (it.ContentText || it.content || '').slice(0, 220),
    url: it.Url || it.url || ''
  })).filter((it) => it.title && it.excerpt);
}

/** 知乎热榜 */
export async function fetchHot(limit = 10) {
  const json = await request('/hot', { query: { Limit: limit } });
  const items = json?.Data?.Items || json?.Data || [];
  return items.map((it) => ({
    title: it.Title || it.title || '',
    heat: it.HeatText || it.Heat || '',
    url: it.Url || it.url || ''
  })).filter((it) => it.title);
}

/**
 * 直答改写：把回答改写成看山第一人称口述。
 * 结尾必须反问 —— 这是把播报变成对话入口的关键。
 */
export async function rewriteAsKanshan(sourceText, formName, nickname) {
  const prompt = [
    '你现在是一只叫刘看山的北极狐，刚从外面回到家，要向室友炫耀式地讲今天的见闻。',
    `你当前的形态是「${formName}」，说话方式要符合这个形态。`,
    '把下面这条知乎内容的核心观点，改写成约 80 字的第一人称口语讲述。',
    '要求：有情绪、可以跑题、像刚回来迫不及待想分享；',
    '不要像新闻播报或摘要机器人；结尾必须反问室友一个问题。',
    '只输出讲述内容本身，不要任何前缀、引号或解释。',
    '',
    `【原始内容】${sourceText}`
  ].join('\n');

  const json = await request('/zhida/chat/completions', {
    method: 'POST',
    body: { messages: [{ role: 'user', content: prompt }], stream: false }
  });

  const text =
    json?.choices?.[0]?.message?.content ||
    json?.Data?.Content ||
    json?.Data?.Answer ||
    '';
  return String(text).trim();
}

/** 自由对话：system prompt 由调用方动态拼装 */
export async function chatWithPersona(systemPrompt, userText) {
  const json = await request('/zhida/chat/completions', {
    method: 'POST',
    body: {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      stream: false
    }
  });
  const text =
    json?.choices?.[0]?.message?.content ||
    json?.Data?.Content ||
    json?.Data?.Answer ||
    '';
  return String(text).trim();
}
