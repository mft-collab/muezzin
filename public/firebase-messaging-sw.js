importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  "apiKey": "AIzaSyBkddJLg_H9Y0MzH5nMkwIKmgx8hm1fyQk",
  "authDomain": "muezzin-c8485.firebaseapp.com",
  "databaseURL": "https://muezzin-c8485-default-rtdb.europe-west1.firebasedatabase.app",
  "projectId": "muezzin-c8485",
  "storageBucket": "muezzin-c8485.firebasestorage.app",
  "messagingSenderId": "863069336186",
  "appId": "1:863069336186:web:d2a06d0b35c03bd79281c3"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const data = payload.data || {};
  const notificationTitle = payload.notification?.title || data.title || 'Yeni Bildirim';
  const actions = [];

  if (data.type === 'asil' || data.type === 'gorev_cagrisi') {
    actions.push({ action: 'onayla', title: 'Gorevi Onayla' });
    actions.push({ action: 'mazeret', title: 'Mazeret Bildir' });
  }

  self.registration.showNotification(notificationTitle, {
    body: payload.notification?.body || data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100, 50, 200],
    data: {
      bildirimId: data.bildirimId,
      uid: data.uid,
      type: data.type
    },
    actions,
    tag: data.bildirimId || 'muezzin-task-notification',
    renotify: true
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action || 'open';
  const data = event.notification.data || {};
  const url = data.bildirimId
    ? `/?notificationAction=${encodeURIComponent(action)}&bildirimId=${encodeURIComponent(data.bildirimId)}`
    : '/';

  // Keep writes inside the app where Firebase Auth, vakit validation, and
  // Firestore rules are already enforced by the same code path.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(url).then((navigatedClient) => {
              return navigatedClient ? navigatedClient.focus() : client.focus();
            });
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
