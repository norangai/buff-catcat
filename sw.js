const CACHE = 'workout-timer-v3';
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'calendar.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png',
  'cats/cat_1_initial.png', 'cats/cat_1_exercise_1.png', 'cats/cat_1_exercise_2.png',
  'cats/cat_1_rest.png', 'cats/cat_1_buff.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
