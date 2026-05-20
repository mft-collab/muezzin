import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// PWA Service Worker Registration
registerSW({ 
  immediate: true,
  onNeedRefresh() {
    // Yeni versiyon mevcut
  },
  onOfflineReady() {
    // Uygulama hazır
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
