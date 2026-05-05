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
  const notificationTitle = payload.notification?.title || 'Yeni Bildirim';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/pwa-192x192.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
