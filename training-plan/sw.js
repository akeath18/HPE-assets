// Retire the previous broad cache. Private drafts and plan snapshots stay out of caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('training-plan-')).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
// Network-only until offline freshness and private storage have an explicit design.
