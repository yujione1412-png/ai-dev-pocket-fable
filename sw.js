/* AI Dev Pocket — Service Worker v2
 * ・index.html(画面本体)はネットワーク優先:デプロイ後すぐ新版に切り替わる
 * ・オフライン時のみキャッシュから起動
 * ・GitHub関連ドメインへの通信は一切キャッシュ・介入しない
 */
const CACHE = 'adp-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

/* GitHub通信はservice worker対象外 */
const BYPASS_HOSTS = [
  'api.github.com',
  'raw.githubusercontent.com',
  'github.com',
  'objects.githubusercontent.com',
  'codeload.github.com'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* GitHub関連・GET以外は介入しない */
  if (BYPASS_HOSTS.includes(url.hostname)) return;
  if (e.request.method !== 'GET') return;

  const isHtml = e.request.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isHtml) {
    /* HTMLはネットワーク優先(常に最新版)→ オフライン時のみキャッシュ */
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => { c.put(e.request, clone); c.put('./index.html', res.clone()); });
        }
        return res;
      }).catch(() => caches.match(e.request, {ignoreSearch:true})
                       .then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  /* アイコン・manifest・CDNはキャッシュ優先(高速起動) */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.origin === self.location.origin }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && (url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
