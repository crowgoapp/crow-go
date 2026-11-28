// Crow Go — Service Worker محدث (Network-First لملفات التطبيق + حماية من تخزين الأخطاء)
// يحل مشكلة N-C5 مع الحفاظ على دعم offline.html والعمل بدون اتصال للملفات المخزنة.

const CACHE_NAME = 'crowgo-shell-2026-11-26-v3'; // غيّر الاسم/التاريخ مع كل نشر مهم
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './waseet.js',
    './admin.js',
    './manifest.json',
    './icon.png',
    './icon-192.png',
    './logo.png',
    './offline.html',
    './privacy.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME)
                    .map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // ملفات التطبيق نفسها: Network-First مع Fallback للكاش ثم offline.html
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(async () => {
                    const cached = await caches.match(req);
                    if (cached) return cached;
                    if (req.mode === 'navigate') {
                        return caches.match('./offline.html');
                    }
                    return Response.error();
                })
        );
        return;
    }

    // طلبات خارجية (Supabase / CDN): من الشبكة دايماً، وفي التنقل عند انقطاع النت نعرض offline.html
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => caches.match('./offline.html'))
        );
    }
});
