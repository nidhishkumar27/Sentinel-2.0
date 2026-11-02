/* Service worker for authority push notifications. Payloads are non-sensitive by design. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* ignore malformed payload */ }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Sentinel', {
      body: d.body || '',
      data: d.data || {},
      tag: (d.data && d.data.incidentId) || 'sentinel',
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/authority';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
