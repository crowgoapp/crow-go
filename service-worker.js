// Crow Go — Service Worker بسيط: يخزن ملفات الواجهة (app shell) عشان التطبيق
// يفتح حتى من غير نت، وبيعرض offline.html بدل صفحة بيضا لو الصفحة مش متخزنة
// ومفيش شبكة (يحل جزء من M7). هذا لا يخزن بيانات Supabase - القراءة/الكتابة
// الفعلية لسه محتاجة اتصال.

const CACHE_NAME = 'crowgo-shell-v1';
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
    './offline.html'
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
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // ملفات التطبيق نفسها: cache-first
    const url = new URL(req.url);
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;
                return fetch(req)
                    .then((res) => {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                        return res;
                    })
                    .catch(() => (req.mode === 'navigate' ? caches.match('./offline.html') : undefined));
            })
        );
        return;
    }

    // طلبات Supabase/الـ CDN: من الشبكة دايماً، ولو الشبكة واقعة ونوع الطلب
    // تصفح صفحة، نرجع offline.html بدل ما يفضل فاضي.
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).catch(() => caches.match('./offline.html')));
    }
});
