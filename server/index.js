/**
 * 看山进化 — 零依赖 Node HTTP 服务
 * 职责：静态资源托管 + 知乎开放平台代理（隐藏密钥）+ 缓存 + 本地兜底。
 * 任何外部失败都降级为本地语料，前端永不白屏。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, publicStatus } from './config.js';
import { cacheGet, cacheSet, consumeQuota, quotaSnapshot, cacheStats } from './cache.js';
import { searchZhihu, fetchHot, rewriteAsKanshan, chatWithPersona } from './zhihu-client.js';
import { MOCK_ANSWERS, MOCK_HOT } from '../data/mock-answers.js';

const PUBLIC_DIR = path.join(CONFIG.ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) raw = raw.slice(0, 1e6);
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 领域 -> 搜索关键词 */
const DOMAIN_QUERY = {
  tech: '科技 前沿 讨论',
  digital: '数码 设备 体验',
  history: '历史 冷知识',
  work: '职场 沟通 成长',
  emotion: '情感 关系 沟通',
  life: '生活 技巧 日常',
  art: '艺术 审美 欣赏',
  food: '美食 做菜 味道'
};

// ---------------------------------------------------------------- 路由

/** GET /api/health */
function handleHealth(res) {
  sendJson(res, 200, {
    ok: true,
    ...publicStatus(),
    quota: quotaSnapshot(CONFIG.DAILY_LIMIT),
    cache: cacheStats(),
    time: new Date().toISOString()
  });
}

/** GET /api/knowledge/search?domain=tech */
async function handleSearch(res, url) {
  const domain = url.searchParams.get('domain') || 'tech';
  const pool = MOCK_ANSWERS[domain] || MOCK_ANSWERS.tech;
  const fallback = { ...pickRandom(pool), source: 'local', domain };

  if (CONFIG.MODE !== 'live') return sendJson(res, 200, { ok: true, data: fallback });

  const cacheKey = `search:${domain}`;
  const cached = cacheGet(cacheKey);
  if (cached && cached.length) {
    return sendJson(res, 200, {
      ok: true,
      data: { ...pickRandom(cached), source: 'cache', domain }
    });
  }

  if (!consumeQuota('search', CONFIG.DAILY_LIMIT.search)) {
    return sendJson(res, 200, { ok: true, data: { ...fallback, source: 'local-quota' } });
  }

  try {
    const items = await searchZhihu(DOMAIN_QUERY[domain] || domain, 6);
    if (!items.length) throw new Error('EMPTY');
    cacheSet(cacheKey, items, CONFIG.CACHE_TTL.search);
    sendJson(res, 200, { ok: true, data: { ...pickRandom(items), source: 'api', domain } });
  } catch {
    sendJson(res, 200, { ok: true, data: { ...fallback, source: 'local-fallback' } });
  }
}

/** GET /api/hot */
async function handleHot(res) {
  const fallback = MOCK_HOT;
  if (CONFIG.MODE !== 'live') {
    return sendJson(res, 200, { ok: true, data: fallback, source: 'local' });
  }

  const cached = cacheGet('hot');
  if (cached) return sendJson(res, 200, { ok: true, data: cached, source: 'cache' });

  if (!consumeQuota('hot', CONFIG.DAILY_LIMIT.hot)) {
    return sendJson(res, 200, { ok: true, data: fallback, source: 'local-quota' });
  }

  try {
    const items = await fetchHot(10);
    if (!items.length) throw new Error('EMPTY');
    cacheSet('hot', items, CONFIG.CACHE_TTL.hot);
    sendJson(res, 200, { ok: true, data: items, source: 'api' });
  } catch {
    sendJson(res, 200, { ok: true, data: fallback, source: 'local-fallback' });
  }
}

/** POST /api/answer/rewrite  { text, formName, nickname } */
async function handleRewrite(req, res) {
  const body = await readBody(req);
  const text = String(body.text || '').slice(0, 600);
  const formName = String(body.formName || '初生看山');

  if (!text) return sendJson(res, 200, { ok: false, reason: 'EMPTY_INPUT', data: '' });

  if (CONFIG.MODE !== 'live') {
    return sendJson(res, 200, { ok: false, reason: 'MOCK_MODE', data: '', source: 'local' });
  }

  const cacheKey = `rewrite:${formName}:${text.slice(0, 40)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return sendJson(res, 200, { ok: true, data: cached, source: 'cache' });

  if (!consumeQuota('answer', CONFIG.DAILY_LIMIT.answer)) {
    return sendJson(res, 200, { ok: false, reason: 'QUOTA', data: '', source: 'local-quota' });
  }

  try {
    const out = await rewriteAsKanshan(text, formName, body.nickname);
    if (!out) throw new Error('EMPTY');
    cacheSet(cacheKey, out, CONFIG.CACHE_TTL.rewrite);
    sendJson(res, 200, { ok: true, data: out, source: 'api' });
  } catch {
    // 不向前端暴露任何堆栈
    sendJson(res, 200, { ok: false, reason: 'UPSTREAM', data: '', source: 'local-fallback' });
  }
}

/** POST /api/dialogue  { system, message } — system prompt 由前端人格层拼装 */
async function handleDialogue(req, res) {
  const body = await readBody(req);
  const message = String(body.message || '').slice(0, 500);
  const system = String(body.system || '').slice(0, 4000);

  if (!message) return sendJson(res, 200, { ok: false, reason: 'EMPTY_INPUT', data: '' });

  if (CONFIG.MODE !== 'live') {
    return sendJson(res, 200, { ok: false, reason: 'MOCK_MODE', data: '', source: 'local' });
  }

  if (!consumeQuota('answer', CONFIG.DAILY_LIMIT.answer)) {
    return sendJson(res, 200, { ok: false, reason: 'QUOTA', data: '', source: 'local-quota' });
  }

  try {
    const out = await chatWithPersona(system, message);
    if (!out) throw new Error('EMPTY');
    sendJson(res, 200, { ok: true, data: out, source: 'api' });
  } catch {
    sendJson(res, 200, { ok: false, reason: 'UPSTREAM', data: '', source: 'local-fallback' });
  }
}

/**
 * POST /api/dialogue/kanshan  { system, message }
 * 通过看山工作台本地 API（OpenAI 兼容格式）完成对话
 * 看山工作台默认在 localhost:3200 暴露 /v1/chat/completions
 */
async function handleDialogueKanshan(req, res) {
  const body = await readBody(req);
  const message = String(body.message || '').slice(0, 500);
  const system = String(body.system || '').slice(0, 4000);

  if (!message) return sendJson(res, 200, { ok: false, reason: 'EMPTY_INPUT', data: '' });

  const KANSHAN_API = process.env.KANSHAN_API_URL || 'http://127.0.0.1:3200/v1/chat/completions';
  const KANSHAN_MODEL = process.env.KANSHAN_MODEL || 'kanshan';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    const apiRes = await fetch(KANSHAN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: KANSHAN_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message }
        ],
        max_tokens: 200,
        temperature: 0.85
      })
    });
    clearTimeout(timer);

    if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
    const json = await apiRes.json();
    const out = json?.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error('EMPTY');

    sendJson(res, 200, { ok: true, data: out, source: 'kanshan' });
  } catch (err) {
    // 任何失败都降级，前端会走本地兜底
    sendJson(res, 200, { ok: false, reason: String(err?.message || 'UPSTREAM'), data: '', source: 'local-fallback' });
  }
}

// ---------------------------------------------------------------- 静态资源

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const safe = path
    .normalize(rel)
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 返回 HTML 格式的 404，防止浏览器把纯文本渲染成页面内容
      // favicon.ico 不存在时返回最小合法 SVG icon，消除 404
      if (path.extname(filePath).toLowerCase() === '.ico') {
        const svgIcon = Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
          '<text y=".9em" font-size="90">🦊</text></svg>'
        );
        res.writeHead(200, {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(svgIcon);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
        '<title>找不到页面</title></head><body style="font-family:sans-serif;' +
        'padding:40px;color:#655c52"><h1>404</h1><p>找不到这个页面。' +
        '<a href="/" style="color:#e08a5c">回主页</a></p></body></html>'
      );
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

// ---------------------------------------------------------------- 入口

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  try {
    if (pathname === '/api/health') return handleHealth(res);
    if (pathname === '/api/knowledge/search') return await handleSearch(res, url);
    if (pathname === '/api/hot') return await handleHot(res);
    if (pathname === '/api/answer/rewrite' && req.method === 'POST')
      return await handleRewrite(req, res);
    if (pathname === '/api/dialogue' && req.method === 'POST')
      return await handleDialogue(req, res);
    if (pathname === '/api/dialogue/kanshan' && req.method === 'POST')
      return await handleDialogueKanshan(req, res);
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, reason: 'NOT_FOUND' });

    serveStatic(req, res, pathname);
  } catch {
    // 统一兜底：不输出堆栈
    sendJson(res, 200, { ok: false, reason: 'INTERNAL', data: '' });
  }
});

server.listen(CONFIG.PORT, () => {
  const mode = CONFIG.MODE === 'live' ? 'live（已配置密钥，允许调用知乎开放平台）' : 'mock（全程本地语料）';
  console.log('─'.repeat(52));
  console.log('  看山进化 已启动');
  console.log(`  地址：http://127.0.0.1:${CONFIG.PORT}`);
  console.log(`  模式：${mode}`);
  console.log('─'.repeat(52));
});
