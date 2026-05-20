import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense, lazy, useEffect } from 'react';
import { motion } from 'motion/react';
import { SplashLoader } from './components/SplashLoader';
import { StoreInitializer } from './components/StoreInitializer';
import { ForegroundNotifications } from './components/ForegroundNotifications';
import { RefreshCw } from 'lucide-react';

import { VakitMonitor } from './components/VakitMonitor';
const MuezzinAnaEkran = lazy(() => import('./pages/MuezzinAnaEkran'));
const HaftalikTakvim = lazy(() => import('./pages/HaftalikTakvim'));
const Profil = lazy(() => import('./pages/Profil'));

const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));

function Fallback({ error }: { error: Error }) {
  const isChunkError = 
    error.message.includes('Failed to fetch dynamically imported module') || 
    error.message.includes('Loading chunk') ||
    error.message.includes('dynamic import');

  useEffect(() => {
    if (isChunkError) {
      // Sonsuz döngüyü engellemek için son reload zamanını kontrol et (15 saniye içinde tekrar reload etmez)
      const lastReload = localStorage.getItem('last-chunk-reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 15000) {
        localStorage.setItem('last-chunk-reload', now.toString());
        const timer = setTimeout(() => {
          window.location.reload();
        }, 1500); // 1.5 saniye sonra otomatik yenile
        return () => clearTimeout(timer);
      }
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--app-bg)] p-8 text-center noise-surface">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="spatial-glass-elevated p-12 max-w-lg w-full border-[var(--text-primary)]/10 shadow-2xl"
        >
          <div className="relative w-20 h-20 bg-indigo-500/10 rounded-[30px] flex items-center justify-center mb-8 mx-auto border border-indigo-500/20 shadow-2xl">
            <RefreshCw size={28} className="text-indigo-400 animate-spin" />
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-30" />
          </div>
          <h1 className="text-3xl font-light text-[var(--text-primary)] tracking-tight mb-4 apple-thin">Yeni Güncelleme Uygulanıyor</h1>
          <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed mb-8">
            Müezzin Takip Pro'nun en son sürümü yayınlandı. Arayüzünüz ve veri akışınızın kesintisiz çalışması için uygulama otomatik olarak yenileniyor...
          </p>
          <div className="flex flex-col gap-2">
            <span className="premium-label !text-[8px] !opacity-30">OTOMATİK YENİLEME BAŞLATILDI</span>
            <span className="text-[10px] text-[var(--text-secondary)]/40 font-mono">Bileşen: {error.message.split('assets/').pop()}</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--app-bg)] p-8 text-center noise-surface">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="spatial-glass-elevated p-12 max-w-lg w-full border-[var(--status-error)]/20"
      >
        <div className="w-20 h-20 bg-[var(--status-error)]/10 rounded-[30px] flex items-center justify-center mb-8 mx-auto border border-[var(--status-error)]/20 shadow-2xl">
          <span className="text-[var(--status-error)] text-4xl">!</span>
        </div>
        <h1 className="text-3xl font-light text-[var(--text-primary)] tracking-tight mb-4 apple-thin">Sistemsel Bir Aksama Oluştu</h1>
        <p className="premium-label !text-[10px] !opacity-20 mb-8">HATA AYRINTILARI</p>
        <pre className="text-[11px] font-mono bg-[var(--text-primary)]/[0.03] p-6 rounded-3xl border border-[var(--glass-border)] text-[var(--status-error)]/80 overflow-auto w-full text-left leading-relaxed mb-10">
          {error.message}
        </pre>
        <motion.button 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => window.location.reload()} 
          className="w-full py-5 bg-[var(--text-primary)] text-[var(--app-bg)] rounded-2xl font-bold text-[10px] uppercase tracking-[0.3em] shadow-[var(--spatial-shadow)] hover:opacity-90 transition-all"
        >
          Uygulamayı Yeniden Başlat
        </motion.button>
      </motion.div>
    </div>
  );
}


export default function App() {
  const handleError = (error: Error, info: { componentStack: string }) => {
    import('./services/telemetryService')
      .then(({ telemetryService }) => {
        telemetryService.logError(error, info.componentStack);
      })
      .catch(err => {
        console.error("Telemetri hata kaydedici dinamik olarak yüklenemedi:", err);
      });
  };

  return (
    <ErrorBoundary FallbackComponent={Fallback} onError={handleError}>
      <BrowserRouter>
        <AuthGuard>
          <StoreInitializer />
          <Layout>
            <VakitMonitor />
            <ForegroundNotifications />
            <Suspense fallback={<SplashLoader />}>
              <Routes>
                <Route path="/" element={<MuezzinAnaEkran />} />
                <Route path="/takvim" element={<HaftalikTakvim />} />
                <Route path="/profil" element={<Profil />} />
                <Route path="/admin" element={<AdminPanel />} />
              </Routes>
            </Suspense>
          </Layout>
        </AuthGuard>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
