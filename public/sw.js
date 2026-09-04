const BALY_RELEASE = '20260904-reliable-push';

const urlBase64ToBytes = (value) => {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    await Promise.all(windows.map(async client => {
      client.postMessage({type: 'BALY_RELEASE_UPDATED', release: BALY_RELEASE});
      if (client.navigate) await client.navigate(client.url);
    }));
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {body: event.data?.text() || ''};
  }

  const title = String(payload.title || 'BALY WELLNESS').slice(0, 120);
  const body = String(payload.body || 'ממתין לך עדכון חדש באפליקציה.').slice(0, 240);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: './icons/baly-icon-192.png',
    badge: './icons/baly-icon-192.png',
    tag: payload.tag ? String(payload.tag).slice(0, 180) : undefined,
    data: {url: payload.url || './'},
  }));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const publicKeyResponse = await fetch(new URL('api/push/public-key', self.registration.scope), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!publicKeyResponse.ok) return;
      const {publicKey} = await publicKeyResponse.json();
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      });
      await fetch(new URL('api/push/subscriptions', self.registration.scope), {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch {
      // The foreground app retries synchronization when it next becomes visible or online.
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const requestedUrl = new URL(event.notification.data?.url || './', self.registration.scope);
    const targetUrl = requestedUrl.origin === self.location.origin ? requestedUrl.href : self.registration.scope;
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const existingWindow = windows.find(client => new URL(client.url).origin === self.location.origin);

    if (existingWindow) {
      await existingWindow.navigate(targetUrl);
      await existingWindow.focus();
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});
