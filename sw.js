// Sankofa Market — Service Worker — Cache shell for instant loads, GHS data via IndexedDB (Firestore persistence) already
// Version: v129 — fresh HTML navigations + videos bypass the image cache.
// Bump CACHE_VERSION on
// any visual overhaul: activate wipes every old cache and the page reloads itself once,
// so phones can never get stuck showing last week's design (some users kept seeing the
// old wishlist layout because their offline copy never refreshed).
// (v14: image requests can never crash the worker; all fallbacks are local files.)
const CACHE_VERSION = 'sankofa-v129';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/css/main.css',
  '/css/product-detail.css',
  '/css/wallet.css',
  '/css/admin.css',
  '/config/firebase-config.js',
  '/images/placeholders/product.svg',
  '/images/placeholders/avatar.svg',
  '/images/logos/sankofa-market-logo-full-color.png',
  '/images/logos/sankofa-market-favicon.png',
  '/images/logos/sankofa-market-app-icon.png'
];

// Install — pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS.map(u => new Request(u, {cache:'reload'})))).catch(()=>{})
  );
  self.skipWaiting();
});

// Activate — remove caches from older versions, keep this version's fresh shell
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Drop caches from older versions so a stale page (and its old CSP header) or a
    // wrong picture can never be served again. Keep the shell this worker just cached.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    } catch (e) {}
    try { await caches.open(SHELL_CACHE); } catch (e) {}
  })());
  self.clients.claim();
});

// Fetch — strategies
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET, chrome extensions, firebase, auth, paystack — never cache auth
  if (req.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  // Firebase Auth / Firestore / Storage / Functions / Google APIs — network only
  if (url.hostname.includes('firestore.googleapis.com')) return;
  if (url.hostname.includes('firebaseio.com')) return;
  if (url.hostname.includes('identitytoolkit.googleapis.com')) return;
  if (url.hostname.includes('securetoken.googleapis.com')) return;
  if (url.hostname.includes('googleapis.com') && (url.pathname.includes('token') || url.pathname.includes('identity') || url.pathname.includes('auth'))) return;
  if (url.hostname === 'www.googleapis.com') return;
  if (url.hostname.includes('firebasestorage.googleapis.com') && url.search.includes('token') && req.destination === 'image') {
    // Cache storage images (product photos) — CacheFirst 30d.
    // Videos are deliberately excluded: they go straight to the browser so Range
    // requests work and the SW never caches a partial 206 response.
    event.respondWith(cacheFirst(req, IMAGE_CACHE, 30*24*60*60));
    return;
  }
  if (url.hostname.includes('paystack') || url.hostname.includes('js.paystack.co')) return;
  if (url.hostname === 'www.gstatic.com') return;

  // Images — cache only same-origin pictures. Cross-origin pictures (Google profile
  // photos, ui-avatars, seller-hosted URLs) are left to the browser: a service-worker
  // fetch() is governed by connect-src, while a normal <img> load is governed by
  // img-src (which allows https:). Intercepting every image made those avatars fail
  // with a CSP error and fall back to the placeholder tile.
  if (req.destination === 'image') {
    if (url.origin === self.location.origin) {
      event.respondWith(cacheFirst(req, IMAGE_CACHE, 30*24*60*60));
    }
    return;
  }

  // Same-origin assets
  if (url.origin === self.location.origin) {
    // 1) Hashed bundles in /dist/ — content-addressed & immutable: serve instantly
    if (url.pathname.startsWith('/dist/')) {
      event.respondWith(cacheFirst(req, SHELL_CACHE));
      return;
    }
    // 2) Auth/config — always ask the network first (never serve a stale config)
    if (url.pathname.startsWith('/config/')) {
      event.respondWith(networkFirst(req, SHELL_CACHE));
      return;
    }
    // 3) Other CSS/JS/fonts — serve cached copy instantly, refresh in background
    if (req.destination === 'style' || req.destination === 'script' || req.destination === 'font' || url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/')) {
      event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
      return;
    }
    // Navigations (HTML) — NetworkFirst with a forced revalidation. Bypassing the
    // HTTP cache matters because the CSP is delivered as an HTML header: without it,
    // a page cached before a CSP change keeps enforcing the old policy until the HTTP
    // cache expires. The SW cache is only a fallback for offline use.
    if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('.html')) {
      event.respondWith(networkFirst(req, PAGE_CACHE, true));
      return;
    }
  }

  // Default: network-first for API/json, cache as fallback
  if (url.pathname.includes('/__/') || url.hostname.includes('firebaseio.com')) return;
});

/** A local picture that is always available — used when an image cannot be fetched. */
function placeholderResponse() {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="640" height="480">' +
    '<rect width="800" height="600" fill="#eef2f7"/>' +
    '<g transform="translate(400 270)"><rect x="-58" y="-44" width="116" height="88" rx="10" fill="none" stroke="#0064d2" stroke-width="6" opacity="0.5"/>' +
    '<circle cx="-24" cy="-14" r="11" fill="#f5af02" opacity="0.85"/>' +
    '<path d="M-58 30 L-14 -8 L14 16 L36 -2 L58 22 L58 44 L-58 44 Z" fill="#0064d2" opacity="0.3"/></g>' +
    '<text x="400" y="384" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="28" font-weight="700" fill="#0064d2" opacity="0.75">Sankofa Market</text>' +
    '<text x="400" y="418" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="20" fill="#64748b">No photo yet</text></svg>';
  return new Response(svg, { headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Sankofa-Placeholder': '1'   // so a stale placeholder can never be trusted from a cache
  } });
}

/**
 * Cache-first fetch that can NEVER reject.
 * If the picture cannot be fetched (host blocked, offline, 404, deleted) we answer
 * with a cached copy, or the local placeholder — never "Failed to fetch".
 */
async function cacheFirst(request, cacheName, maxAgeSec) {
  const isImage = request.destination === 'image';
  let cached = null;
  try {
    const cache = await caches.open(cacheName);
    cached = await cache.match(request);
    if (cached && cached.headers.get('X-Sankofa-Placeholder')) cached = null;   // never trust a cached tile
  } catch (e) { /* cache unavailable — carry on to the network */ }

  if (cached) {
    if (!maxAgeSec) return cached;
    const date = cached.headers.get('date');
    if (!date) return cached;
    const age = (Date.now() - new Date(date).getTime()) / 1000;
    if (age < maxAgeSec) return cached;
  }

  const usable = (res) => !!res && (res.ok || res.type === 'opaque');

  try {
    const res = await fetch(request);
    // ⚠️ IMPORTANT: a cross-origin picture (Firebase Storage, any CDN) comes back as an
    // "opaque" response — status 0, so `res.ok` is FALSE even though the picture is perfect.
    // Treating that as a failure replaced every product photo with the placeholder tile
    // ("No photo yet"). Opaque responses must count as success.
    if (usable(res)) {
      try {
        const cache = await caches.open(cacheName);
        cache.put(request, res.clone());
      } catch (e) { /* quota / private mode — ignore */ }
      return res;
    }
    // Real server error (404/403) — for a picture, retry once bypassing every cache layer.
    if (isImage) {
      const retried = await retryBypassingCaches(request);
      if (retried) return retried;
      if (cached) return cached;
      // Hand the real error to the page ON PURPOSE: the page's own fallback then tries the
      // full-size picture before showing "No photo yet" (see smImgFallback in js/main.js).
      // The tile is only used when the network itself is unreachable (catch below).
      return res;
    }
    return res;
  } catch (e) {
    if (isImage) {
      const retried = await retryBypassingCaches(request);
      if (retried) return retried;
      return cached || placeholderResponse();
    }
    // Non-image (JS/CSS/HTML): let the caller fall back to its own strategy.
    throw e;
  }
}

/**
 * Last-resort retry for a picture: asks the network again with a cache-busting query
 * parameter, so a stale/failed copy held by the browser can never block a good photo.
 */
async function retryBypassingCaches(request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.has('smcb')) return null;
    url.searchParams.set('smcb', String(Date.now()));
    const res = await fetch(url.toString(), { cache: 'reload', mode: 'no-cors' });
    if (res && (res.ok || res.type === 'opaque')) return res;
    return null;
  } catch (e) { return null; }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  let cached = null;
  try { cached = await cache.match(request); } catch (e) {}
  const network = fetch(request).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) return cached;               // instant
  const res = await network;
  if (res) return res;
  // Offline and nothing cached: a picture gets the placeholder, anything else a
  // clean 504 so the page fails softly instead of throwing.
  if (request.destination === 'image') return placeholderResponse();
  return new Response('', { status: 504, statusText: 'Offline' });
}

async function networkFirst(request, cacheName, bypassHttpCache) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request, bypassHttpCache ? { cache: 'reload' } : undefined);
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback to cached index or offline
    const fallback = await cache.match('/index.html') || await cache.match('/') || await cache.match('/offline.html');
    if (fallback) return fallback;
    if (request.destination === 'image') return placeholderResponse();
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

// Message handler — skip waiting on update
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
