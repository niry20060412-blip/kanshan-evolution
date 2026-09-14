/**
 * Service Worker — 看山进化
 * 功能：离线可用（缓存优先），支持 PWA 安装到桌面/手机
 */
const CACHE = 'kanshan-v2';

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
  '/manifest.json',
  '/manifest-pet.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // 只处理 GET；API 请求走网络优先，失败时不兜底（避免返回旧数据）
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // 知乎 API / dialogue / rewrite 路由 → 纯网络，不缓存
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      });
      return cached || network;
    })
  );
});
