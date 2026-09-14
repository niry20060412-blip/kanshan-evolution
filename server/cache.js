/**
 * 内存缓存 + 每日额度熔断。
 * 直答 100 次/天是硬约束，这里做本地保护。
 */

const store = new Map();
const counters = new Map();

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlSeconds) {
  store.set(key, { value, expireAt: Date.now() + ttlSeconds * 1000 });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** 返回 true 表示还有额度并已计数；false 表示已触顶 */
export function consumeQuota(name, limit) {
  const key = `${todayKey()}:${name}`;
  const used = counters.get(key) || 0;
  if (used >= limit) return false;
  counters.set(key, used + 1);
  return true;
}

export function quotaSnapshot(limits) {
  const day = todayKey();
  const out = {};
  for (const [name, limit] of Object.entries(limits)) {
    out[name] = { used: counters.get(`${day}:${name}`) || 0, limit };
  }
  return out;
}

export function cacheStats() {
  return { entries: store.size };
}
