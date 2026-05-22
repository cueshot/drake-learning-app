const CACHE_NAME = 'sensei-v1';

// Everything needed to study flashcards with zero network
const PRECACHE = [
    './vocab.html',
    './dashboard.html',
    './manifest.json',
    './icon.svg'
];

// ── Install: pre-fetch and cache key pages ──────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())   // activate immediately
    );
});

// ── Activate: delete stale caches from old versions ────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())  // take control of open tabs
    );
});

// ── Fetch: cache-first for local pages, passthrough for external ────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Never intercept requests to external origins (Anthropic API, CDNs, etc.)
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            // Serve from cache immediately if available
            if (cached) {
                // Revalidate in the background so the cache stays fresh
                fetch(event.request)
                    .then(response => {
                        if (response.ok) {
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, response));
                        }
                    })
                    .catch(() => {}); // ignore network errors during background refresh
                return cached;
            }

            // Not in cache — fetch from network and cache the result
            return fetch(event.request)
                .then(response => {
                    if (response.ok && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    // Offline fallback: send vocab.html for any navigation request
                    if (event.request.mode === 'navigate') {
                        return caches.match('./vocab.html');
                    }
                });
        })
    );
});
