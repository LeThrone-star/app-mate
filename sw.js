/* Astral — funzionamento offline.
   Le pagine vengono salvate sul dispositivo: si aprono subito dalla copia
   salvata e intanto si scarica in sottofondo la versione nuova.
   Cambia VERSION a ogni aggiornamento del sito. */
const VERSION = 'astral-v3';
const CORE = [
  './', 'index.html', 'grafici.html', 'calcolatrice.html', 'matematica.html', 'fisica.html', 'teoria.html',
  'manifest.webmanifest',
  'assets/style.css', 'assets/common.js', 'assets/parser.js', 'assets/plot.js', 'assets/keypad.js',
  'assets/grapher.js', 'assets/calc.js', 'assets/mathlab.js', 'assets/physics.js', 'assets/tutor.js',
  'assets/favicon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const katex = url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/katex@');
  if (!sameOrigin && !katex) return;

  event.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const fresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(fresh); return cached; }
    const res = await fresh;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }));
});
