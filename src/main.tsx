import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// PWA Service Worker Registration
registerSW({ 
  immediate: true,
  onNeedRefresh() {
    console.log('Yeni versiyon mevcut, lütfen sayfayı yenileyin.');
  },
  onOfflineReady() {
    console.log('Uygulama çevrimdışı kullanım için hazır.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
