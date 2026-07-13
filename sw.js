/* AI Dev Pocket — Service Worker
 * ・アプリシェルを事前キャッシュしてオフライン起動に対応
 * ・GitHub API / GitHub関連ドメインへの通信は一切キャッシュ・介入しない
 */
const CACHE = 'adp-v1';
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

  /* GitHub関連・GET以外は介入しない(ブラウザが直接通信) */
  if (BYPASS_HOSTS.includes(url.hostname)) return;
  if (e.request.method !== 'GET') return;

  /* アプリシェル:キャッシュ優先 → なければネットワーク(取得後キャッシュ) */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.origin === self.location.origin }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && (url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com')) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        /* オフライン時はトップページへフォールバック */
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
