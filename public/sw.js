/**
 * Service Worker — 看山进化
 *
 * 策略（v6 起改为「网络优先」，修掉旧版「缓存优先」把内容永久锁死的坑）：
 * - `/api/*`      纯网络，不缓存，避免返回过期数据
 * - 页面导航      网络优先；断网回缓存，再不行回首页
 * - js / css / json  网络优先：代码更新后一次性生效，不用等缓存过期
 * - 图片等静态资源   缓存优先：体积大且基本不变，优先保证秒开与离线
 * 离线时都回退到预缓存，保证「打开就有东西」。
 */
const CACHE = 'kanshan-v6';

const PRECACHE = [
  '/',
  '/index.html',
  '/pet.html',
  '/css/style.css',
  '/js/main.js',
  '/js/pet-window.js',
  '/js/storage.js',
  '/js/game.js',
  '/js/api.js',
  '/js/local-knowledge.js',
  '/js/persona.js',
  '/js/pet-renderer.js',
  '/js/config/domains.js',
  '/js/config/forms.js',
  '/js/config/affinity.js',
  '/js/config/souvenirs.js',
  '/js/config/npc.js',
  '/js/config/corpus.js',
  '/assets/kanshan-96.png',
  '/assets/kanshan-192.png',
  '/assets/kanshan-288.png',
  '/assets/kanshan-full.png',
  '/assets/anim-hello.gif',
  '/assets/anim-work.gif',
  '/assets/anim-play.gif',
  '/assets/anim-doze.gif',
  '/manifest.json',
  '/manifest-pet.json'
];

self.addEventListener('install', (e) => {
  // 逐个缓存：某一个文件 404 时不让整次安装失败（旧版用 addAll，一失败就永远装不上）
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((path) =>
          cache.add(path).catch(() => {
            /* 单个资源失败可忽略 */
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** 网络优先：联网时永远拿最新的，断网才用缓存 */
async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const pathname = new URL(request.url).pathname;
    const cached =
      (await cache.match(request)) ||
      (await cache.match(pathname)) ||
      (fallbackPath ? await cache.match(fallbackPath) : null);
    return cached || new Response('', { status: 504, statusText: 'Offline' });
  }
}

/** 缓存优先：命中即返回，同时后台更新，保证下次是最新的 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);

  return cached || (await network) || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // 接口请求：纯网络，绝不缓存
  if (url.pathname.startsWith('/api/')) return;

  // 页面导航
  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request, '/index.html'));
    return;
  }

  // 代码与样式：网络优先，更新立刻生效
  if (/\.(?:js|css|json|webmanifest)$/.test(url.pathname)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // 其它静态资源（图片、字体等）
  e.respondWith(cacheFirst(e.request));
});
