/**
 * 服务端配置：只从环境变量读取密钥，绝不下发前端。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** 极简 .env 解析，避免引入依赖 */
function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const secret = (process.env.ZHIHU_ACCESS_SECRET || '').trim();
const requestedMode = (process.env.APP_MODE || 'mock').trim().toLowerCase();

export const CONFIG = {
  ROOT,
  PORT: Number(process.env.PORT) || 3100,
  /** 没有密钥时强制 mock，保证零配置也能完整运行 */
  MODE: secret && requestedMode === 'live' ? 'live' : 'mock',
  HAS_SECRET: Boolean(secret),
  REQUEST_TIMEOUT_MS: Number(process.env.REQUEST_TIMEOUT_MS) || 8000,
  API_BASE: 'https://developer.zhihu.com/api/v1',
  CACHE_TTL: {
    search: Number(process.env.CACHE_TTL_SEARCH) || 21600,
    hot: Number(process.env.CACHE_TTL_HOT) || 1800,
    rewrite: Number(process.env.CACHE_TTL_REWRITE) || 86400
  },
  DAILY_LIMIT: {
    answer: Number(process.env.DAILY_LIMIT_ANSWER) || 60,
    search: Number(process.env.DAILY_LIMIT_SEARCH) || 8,
    hot: Number(process.env.DAILY_LIMIT_HOT) || 2
  }
};

/** 仅在服务端内部使用 */
export function getSecret() {
  return secret;
}

/** 可安全下发前端的运行状态（不含任何密钥） */
export function publicStatus() {
  return {
    mode: CONFIG.MODE,
    usingMock: CONFIG.MODE === 'mock',
    secretConfigured: CONFIG.HAS_SECRET
  };
}
