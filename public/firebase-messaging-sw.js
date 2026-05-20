importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-auth-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore-compat.js');

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
  // Eğer bildirim bir görev atamasıysa etkileşimli butonları ekle
  if (data.type === 'asil' || data.type === 'gorev_cagrisi') {
    actions.push({
      action: 'onayla',
      title: 'Görevi Onayla ✅'
    });
    actions.push({
      action: 'mazeret',
      title: 'Mazeret Bildir ⚠️'
    });
  }

  const notificationOptions = {
    body: payload.notification?.body || data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100, 50, 200],
    data: {
      bildirimId: data.bildirimId,
      uid: data.uid,
      type: data.type
    },
    actions: actions,
    tag: data.bildirimId || 'muezzin-task-notification',
    renotify: true
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Arka planda gelen bildirim butonlarının tıklanma işlemlerini yakala
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'onayla') {
    if (data.bildirimId && data.uid) {
      const db = firebase.firestore();
      
      event.waitUntil(
        db.collection('bildirimler').doc(data.bildirimId).update({
          durum: 'onaylandi',
          pendingAck: false,
          sonGuncelleme: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
          // Müezzinin aylık puanını (aylikVakitSayisi) 1 artır
          return db.collection('muezzins').doc(data.uid).update({
            aylikVakitSayisi: firebase.firestore.FieldValue.increment(1)
          });
        })
        .then(() => {
          console.log(`[SW] Bildirim ${data.bildirimId} arka planda başarıyla onaylandı.`);
        })
        .catch((err) => {
          console.error("[SW] Arka plan onaylama hatası:", err);
        })
      );
    }
  } else {
    // Eylem 'mazeret' ise veya bildirimin kendisine tıklanmışsa uygulamayı aç/odakla
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

