import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense, lazy, useEffect } from 'react';
import { SplashLoader } from './components/SplashLoader';
import { StoreInitializer } from './components/StoreInitializer';
import { ForegroundNotifications } from './components/ForegroundNotifications';
import { ChunkErrorFallback } from './components/ChunkErrorFallback';

import { VakitMonitor } from './components/VakitMonitor';
import { telemetryService } from './services/telemetryService';
import { initTimeSync } from './lib/timeSync';
import { toError } from './lib/errorUtils';
import type { ErrorInfo } from 'react';
import MuezzinAnaEkran from './pages/MuezzinAnaEkran';
const HaftalikTakvim = lazy(() => import('./pages/HaftalikTakvim'));
const Profil = lazy(() => import('./pages/Profil'));
const MuezzinAyarlari = lazy(() => import('./pages/MuezzinAyarlari'));

const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));

// Müezzin ekranları ↔ admin paneli arası route değişiminde sert kesme yerine
// kısa bir cross-fade — location.pathname'i key yapıp AnimatePresence'a
// veriyoruz, Routes'a da aynı location'ı geçiyoruz ki eskisi çıkış animasyonu
// oynarken router zaten yeni sayfaya geçmiş olmasın.
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<MuezzinAnaEkran />} />
          <Route path="/takvim" element={<HaftalikTakvim />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/ayarlar" element={<MuezzinAyarlari />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  // İlk açılışta zaman senkronizasyonunu başlat (arka planda çalışır)
  useEffect(() => {
    initTimeSync();
  }, []);

  const handleError = (rawError: unknown, info: ErrorInfo) => {
    const error = toError(rawError);
    try {
      telemetryService.addBreadcrumb(
        `React ErrorBoundary: ${error.message.slice(0, 100)}`,
        'system',
        { componentStack: (info.componentStack ?? '').slice(0, 300) }
      );
      telemetryService.logError(error, info.componentStack ?? '');
    } catch (err) {
      console.error("Telemetri hata kaydedici hatası:", err);
    }
  };

 return (
 <ErrorBoundary
 FallbackComponent={({ error }) => <ChunkErrorFallback error={toError(error)} variant="fullPage" autoReload />}
 onError={handleError}
 >
 <BrowserRouter>
 <AuthGuard>
 <StoreInitializer />
 <Layout>
 <VakitMonitor />
 <ForegroundNotifications />
 <Suspense fallback={
          <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-10 min-h-[80vh] flex flex-col gap-8 opacity-50 mt-16 lg:mt-0">
            <div className="w-64 h-10 bg-[var(--text-primary)]/5 rounded-full animate-pulse" />
            <div className="flex-1 w-full bg-[var(--text-primary)]/[0.02] rounded-card border border-[var(--glass-border)] animate-pulse spatial-glass" />
          </div>
        }>
 <AnimatedRoutes />
 </Suspense>
 </Layout>
 </AuthGuard>
 </BrowserRouter>
 </ErrorBoundary>
 );
}
