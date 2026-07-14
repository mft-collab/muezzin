import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import MuezzinAnaEkran from './pages/MuezzinAnaEkran';
const HaftalikTakvim = lazy(() => import('./pages/HaftalikTakvim'));
const Profil = lazy(() => import('./pages/Profil'));
const MuezzinAyarlari = lazy(() => import('./pages/MuezzinAyarlari'));

const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));

export default function App() {
  // İlk açılışta zaman senkronizasyonunu başlat (arka planda çalışır)
  useEffect(() => {
    initTimeSync();
  }, []);

  const handleError = (error: Error, info: { componentStack: string }) => {
    try {
      telemetryService.addBreadcrumb(
        `React ErrorBoundary: ${error.message.slice(0, 100)}`,
        'system',
        { componentStack: info.componentStack.slice(0, 300) }
      );
      telemetryService.logError(error, info.componentStack);
    } catch (err) {
      console.error("Telemetri hata kaydedici hatası:", err);
    }
  };

 return (
 <ErrorBoundary
 FallbackComponent={({ error }) => <ChunkErrorFallback error={error} variant="fullPage" autoReload />}
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
            <div className="flex-1 w-full bg-[var(--text-primary)]/[0.02] rounded-[40px] border border-[var(--glass-border)] animate-pulse spatial-glass" />
          </div>
        }>
 <Routes>
 <Route path="/" element={<MuezzinAnaEkran />} />
 <Route path="/takvim" element={<HaftalikTakvim />} />
 <Route path="/profil" element={<Profil />} />
 <Route path="/ayarlar" element={<MuezzinAyarlari />} />
 <Route path="/admin" element={<AdminPanel />} />
 </Routes>
 </Suspense>
 </Layout>
 </AuthGuard>
 </BrowserRouter>
 </ErrorBoundary>
 );
}
