// 우리집 보드 서비스 워커 — 홈 화면 앱 설치·끊김 대비용. 가족 데이터(/api/)는 절대 저장하지 않는다.
// 화면을 고쳐 올릴 때 VERSION 을 올리면 옛 저장본이 지워진다.
const VERSION = '21-2026-11-18';
const CACHE = 'urijip-' + VERSION;
const SHELL = ['/', '/study.html', '/games.html', '/app.css', '/theme.css', '/skins.css', '/grapes.js', '/hangul.js', '/progress.js', '/race.html', '/race-core.mjs', '/icon.svg', '/manifest.webmanifest'];
const NET_WAIT = 3000; // 인터넷이 느리면 3초 뒤 저장본을 보여 준다

// /study, /study.html 처럼 같은 화면은 한 이름으로 저장한다 (Cloudflare 는 .html 을 뺀 주소로 보낸다)
function pageKey(url) {
  let p = url.pathname;
  if (p === '/' || p === '/index' || p === '/index.html') return '/';
  if (!p.endsWith('.html') && !p.includes('.', p.lastIndexOf('/'))) p += '.html';
  return p;
}
// 다른 주소로 넘어간(redirect) 응답은 화면 이동에 다시 쓸 수 없어서 깨끗한 응답으로 바꿔 저장한다
async function clean(r) {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers });
}
function withTimeout(p, ms) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (u) => {
      try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u === '/' ? '/' : pageKey(new URL(u, location.href)), await clean(r)); } catch { /* 하나 못 받아도 설치는 계속 */ }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// 화면(HTML): 인터넷 먼저(3초) → 저장본 → 첫 화면. 다른 파일 요청에는 첫 화면을 대신 주지 않는다.
async function page(req) {
  const url = new URL(req.url), key = pageKey(url), c = await caches.open(CACHE);
  try {
    const r = await withTimeout(fetch(req), NET_WAIT);
    if (r.ok) { const copy = await clean(r.clone()); c.put(key, copy).catch(() => {}); }
    return r;
  } catch {
    return (await c.match(key)) || (await c.match('/')) ||
      new Response('<meta charset="utf-8"><p style="font:20px sans-serif;padding:24px">인터넷이 끊겼어요. 연결되면 다시 열어 주세요.</p>', { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}
// css·js: 인터넷 먼저(3초) → 저장본 (새 화면과 옛 스크립트가 섞이지 않게)
async function code(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await withTimeout(fetch(req), NET_WAIT);
    if (r.ok) c.put(req, r.clone()).catch(() => {});
    return r;
  } catch {
    const m = await c.match(req, { ignoreSearch: true });
    if (m) return m;
    throw new Error('offline');
  }
}
// 글꼴·그림·지도: 저장본을 바로 쓰고 뒤에서 새로 받아 둔다 (stale-while-revalidate)
async function asset(req, ev) {
  const c = await caches.open(CACHE), m = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()).catch(() => {}); return r; });
  if (m) { ev.waitUntil(net.catch(() => {})); return m; }
  return net;
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') return e.respondWith(page(req));
  if (/\.(css|js|mjs)$/.test(url.pathname) && url.pathname !== '/world-map.js') return e.respondWith(code(req));
  if (/\.(woff2|png|svg|jpg|webp|webmanifest)$/.test(url.pathname) || url.pathname === '/world-map.js') return e.respondWith(asset(req, e));
});
