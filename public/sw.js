const CACHE_NAME = 'cortex-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/favicon.png',
    '/manifest.webmanifest'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Skip API calls from standard caching, let offlineService handle them
    if (req.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(req).then((cachedResponse) => {
            return cachedResponse || fetch(req);
        })
    );
});
