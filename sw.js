// Service worker de MedTopix: recibe los avisos del servidor (push) aunque la app esté cerrada.
// El Apple Watch y los relojes Wear OS replican estas notificaciones desde el celular.
var CACHE = 'medtopix-v1';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

// Solo la pantalla de la app se guarda para abrirla sin conexión; los datos siempre van a la red.
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate' || url.pathname !== '/app') return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put('/app', copy); });
    return res;
  }).catch(function () { return caches.match('/app'); }));
});

function tellClients(msg) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    list.forEach(function (c) { c.postMessage(msg); });
    return list;
  });
}

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  var options = {
    body: d.body || '', tag: d.tag || 'medtopix', renotify: true, requireInteraction: true,
    icon: '/img/icon-192.png', badge: '/img/badge-96.png', vibrate: [300, 100, 300, 100, 300],
    data: { url: d.url || '/app', dose: d.dose || null }
  };
  // iOS ignora los botones; ahí el toque abre la app en Alertas
  if (d.dose) options.actions = [{ action: 'yes', title: 'Usó la medicación' }, { action: 'no', title: 'No la usó' }];
  e.waitUntil(self.registration.showNotification(d.title || 'MedTopix', options).then(function () { return tellClients({ type: 'push' }); }));
});

self.addEventListener('notificationclick', function (e) {
  var data = e.notification.data || {};
  e.notification.close();
  if ((e.action === 'yes' || e.action === 'no') && data.dose) {
    e.waitUntil(fetch('/api/adherence', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medId: data.dose.medId, date: data.dose.date, status: e.action, scheduledTime: data.dose.scheduledTime, actualTime: data.dose.scheduledTime })
    }).then(function (res) {
      if (!res.ok) throw new Error('no guardado');
      return tellClients({ type: 'recorded' });
    }).catch(function () { return self.clients.openWindow(data.url || '/app'); }));
    return;
  }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (new URL(list[i].url).pathname === '/app' && 'focus' in list[i]) { list[i].postMessage({ type: 'push' }); return list[i].focus(); }
    }
    return self.clients.openWindow(data.url || '/app');
  }));
});
