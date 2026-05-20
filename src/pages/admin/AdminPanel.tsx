import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { getCountFromServer, query, collection, where } from 'firebase/firestore';
import { useKrizAlarmlari } from '../../hooks/admin/useKrizAlarmlari';
import { useAuthStore } from '../../store/useAuthStore';
import { useMuezzinStore } from '../../store/useMuezzinStore';
import { motion, AnimatePresence } from 'motion/react';
import { SplashLoader } from '../../components/SplashLoader';
import { useThemeStore } from '../../store/useThemeStore';

import { useEzanVakitleri } from '../../hooks/useEzanVakitleri';
import { useMevcutVakit } from '../../hooks/useMevcutVakit';
import { IslamicGeometricBg } from '../../components/ui/IslamicGeometricBg';

import { SlimSidebar } from './components/SlimSidebar';
import { MobileDock } from './components/MobileDock';
import { CommandPalette } from './components/CommandPalette';
import ExecutiveHeroScreen from './modules/ExecutiveHeroScreen';

const HaftalikCizelge = lazy(() => import('./modules/HaftalikCizelge'));
const KrizAlarmlari = lazy(() => import('./modules/KrizAlarmlari'));
const SistemAnalitigi = lazy(() => import('./modules/SistemAnalitigi'));
const PersonelHub = lazy(() => import('./modules/PersonelHub'));
const AyarlarHub = lazy(() => import('./modules/AyarlarHub'));
const DuyuruYonetimi = lazy(() => import('./modules/DuyuruYonetimi').then(m => ({ default: m.DuyuruYonetimi })));

function AdminTabFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  const isChunkError = 
    error.message.includes('Failed to fetch dynamically imported module') || 
    error.message.includes('Loading chunk') ||
    error.message.includes('dynamic import');

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="spatial-glass-elevated p-8 max-w-md w-full border-[var(--status-error)]/20"
      >
        <div className="w-16 h-16 bg-[var(--status-error)]/10 rounded-[24px] flex items-center justify-center mb-6 mx-auto border border-[var(--status-error)]/20 shadow-2xl">
          <span className="text-[var(--status-error)] text-3xl font-light">!</span>
        </div>
        <h3 className="text-xl font-light text-[var(--text-primary)] tracking-tight mb-2 apple-thin">
          {isChunkError ? 'Yeni Sürüm Tespit Edildi' : 'Bileşen Yüklenemedi'}
        </h3>
        <p className="text-[11px] text-[var(--text-secondary)]/70 leading-relaxed mb-6">
          {isChunkError 
            ? 'Sistemde yeni bir güncelleme yayınlandığı için bu modülün yeniden yüklenmesi gerekiyor.' 
            : 'Seçilen modül yüklenirken geçici bir hata oluştu.'}
        </p>
        <motion.button 
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            resetErrorBoundary();
            window.location.reload();
          }} 
          className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white border border-indigo-400 rounded-xl font-bold text-[9px] uppercase tracking-[0.2em] shadow-[0_10px_20px_rgba(99,102,241,0.2)] transition-all"
        >
          {isChunkError ? 'Sürümü Güncelle & Yenile' : 'Sayfayı Yeniden Yükle'}
        </motion.button>
      </motion.div>
    </div>
  );
}

export default function AdminPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  
  const [isPending, startTransition] = React.useTransition();

  const setActiveTab = (tab: string) => {
    startTransition(() => {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.set('tab', tab);
        newParams.delete('subtab');
        return newParams;
      });
    });
  };

  const prefetchTab = (tab: string) => {
    switch (tab) {
      case 'planlama': import('./modules/HaftalikCizelge'); break;
      case 'ekip': import('./modules/PersonelHub'); break;
      case 'ayarlar': import('./modules/AyarlarHub'); break;
    }
  };

  const [drawerContent, setDrawerContent] = useState<'alarmlar' | 'duyurular' | null>(null);
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.isAdmin);
  const authLoading = useAuthStore(s => s.loading);
  
  // Stats & States
  const muezzinlerLength = useMuezzinStore(s => s.muezzinler.length);
  const { cozulmamisSayisi } = useKrizAlarmlari();
  const [pendingIzinler, setPendingIzinler] = useState(0);

  // Sirkadiyen Aura Entegrasyonu
  const { bugunVakitler } = useEzanVakitleri();
  const mevcutVakit = useMevcutVakit(bugunVakitler);

  // Aktif vakte göre ana aura rengi
  const activeAuraColor = useMemo(() => {
    switch (mevcutVakit) {
      case 'aksam': return 'var(--aura-rose)';
      case 'yatsi': return 'var(--aura-indigo)';
      case 'ogle': 
      case 'ikindi': return 'var(--aura-amber)';
      case 'sabah': return 'var(--aura-emerald)';
      default: return 'var(--aura-indigo)';
    }
  }, [mevcutVakit]);

  // Sekonder tamamlayıcı aura rengi (kontrast için)
  const secondaryAuraColor = useMemo(() => {
    switch (mevcutVakit) {
      case 'aksam': return 'var(--aura-indigo)';
      case 'yatsi': return 'var(--aura-emerald)';
      case 'ogle': 
      case 'ikindi': return 'var(--aura-rose)';
      case 'sabah': return 'var(--aura-amber)';
      default: return 'var(--aura-emerald)';
    }
  }, [mevcutVakit]);


  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      try {
        const cachedIzin = sessionStorage.getItem('admin_pendingIzinler');
        const cachedDuyuru = sessionStorage.getItem('admin_activeDuyurular');
        const cacheTime = sessionStorage.getItem('admin_counts_time');
        
        const isCacheValid = cacheTime && (Date.now() - parseInt(cacheTime) < 5 * 60 * 1000); // 5 minutes TTL

        if (isCacheValid && cachedIzin !== null && cachedDuyuru !== null) {
          if (mounted) {
            setPendingIzinler(parseInt(cachedIzin));
          }
          return;
        }

        const izinSnap = await getCountFromServer(query(collection(db, 'izinler'), where('durum', '==', 'onay_bekliyor')));
        const duyuruSnap = await getCountFromServer(collection(db, 'duyurular'));
        
        if (mounted) {
          setPendingIzinler(izinSnap.data().count);
          sessionStorage.setItem('admin_pendingIzinler', izinSnap.data().count.toString());
          sessionStorage.setItem('admin_activeDuyurular', duyuruSnap.data().count.toString());
          sessionStorage.setItem('admin_counts_time', Date.now().toString());
        }
      } catch (err) {
        console.error("Count fetch error:", err);
      }
    };
    
    fetchCounts();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin === false) {
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  if (authLoading) return <SplashLoader />;
  if (!isAdmin) return null;

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-10">
            <ExecutiveHeroScreen 
              muezzinlerSayisi={muezzinlerLength}
              cozulmamisSayisi={cozulmamisSayisi}
              pendingIzinler={pendingIzinler}
              setActiveTab={setActiveTab}
              onOpenDrawer={setDrawerContent}
            />
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <SistemAnalitigi onInceleClick={() => setActiveTab('planlama')} />
            </motion.div>
          </div>
        );
      case 'planlama':
        return <HaftalikCizelge />;
      case 'ekip':
        return <PersonelHub />;
      case 'ayarlar':
        return <AyarlarHub />;
      default:
        return null;
    }
  }, [activeTab, muezzinlerLength, cozulmamisSayisi, pendingIzinler]);

  const pageTitle = useMemo(() => {
    switch (activeTab) {
      case 'dashboard': return 'Genel Bakış';
      case 'planlama': return 'Nöbet Çizelgesi';
      case 'ekip': return 'Personel Yönetimi';
      case 'ayarlar': return 'Sistem Ayarları';
      default: return '';
    }
  }, [activeTab]);

  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className="min-h-screen flex lg:flex-row bg-[var(--app-bg)] font-apple pb-24 lg:pb-0 overflow-hidden selection:bg-indigo-500/20 selection:text-indigo-400 fluid-transition">
      
      {/* Dynamic Ambient Auras (Sirkadiyen Geçiş) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div 
          className="absolute top-[10%] left-[-15%] w-[60%] h-[60%] blur-[200px] rounded-full animate-aura transition-all duration-1000" 
          style={{ 
            background: `radial-gradient(circle, ${activeAuraColor} 0%, transparent 70%)` 
          }}
        />
        <div 
          className="absolute bottom-[10%] right-[-15%] w-[60%] h-[60%] blur-[200px] rounded-full animate-aura transition-all duration-1000" 
          style={{ 
            background: `radial-gradient(circle, ${secondaryAuraColor} 0%, transparent 70%)`,
            animationDelay: '-4s'
          }}
        />
      </div>

      {/* Spiritüel Doku Bütünlüğü */}
      <IslamicGeometricBg />

      <CommandPalette />
      
      {/* Navigation Ecosystem */}
      <MobileDock 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        pendingIzinler={pendingIzinler}
        cozulmamisSayisi={cozulmamisSayisi}
        onLogout={() => navigate('/')}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <SlimSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onLogout={() => navigate('/')}
        pendingIzinler={pendingIzinler}
        cozulmamisSayisi={cozulmamisSayisi}
        onPrefetch={prefetchTab}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-[80px] px-2 py-4 lg:p-8 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            className="max-w-screen-2xl mx-auto"
          >
            {/* Authority Header */}
            <header className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-1 rounded-full bg-[var(--status-info)]" />
                <span className="premium-label !text-[7px] !opacity-40 uppercase tracking-[0.2em]">YÖNETİM</span>
              </div>
              <h1 className={`text-2xl lg:text-3xl font-light text-[var(--text-primary)] tracking-tight leading-none fluid-transition group-hover:font-bold duration-700 ${isPending ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
                {pageTitle}
              </h1>
            </header>

            <div className={`spatial-glass p-4 lg:p-6 min-h-[70vh] fluid-transition ${isPending ? 'scale-[0.99] opacity-60' : 'scale-100'} !rounded-[32px]`}>
               <ErrorBoundary FallbackComponent={AdminTabFallback} onReset={() => setSearchParams(prev => prev)}>
                  <Suspense fallback={<div className="h-96 flex items-center justify-center"><SplashLoader /></div>}>
                    {renderContent}
                  </Suspense>
               </ErrorBoundary>
            </div>
          </motion.div>
        </AnimatePresence>

      </main>
      
      {/* Global Drawer (Neural Overlay) - Portaled for Mobile Stability */}
      {createPortal(
        <AnimatePresence>
          {drawerContent && (
            <div key="admin-drawer" className="fixed inset-0 z-[400] flex justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerContent(null)}
                className="absolute inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-[40px]"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 250 }}
                className="relative w-full md:w-[700px] lg:w-[900px] bg-[var(--app-bg)] shadow-2xl flex flex-col h-[100dvh]"
              >
                <div className="flex items-center justify-between phi-padding spatial-glass rounded-none border-b border-[var(--glass-border)] relative z-50">
                  <div>
                    <p className="authority-title text-[8px] mb-2 opacity-30">SİSTEM MODÜLÜ</p>
                    <h2 className="text-3xl font-light text-[var(--text-primary)] tracking-tight">
                      {drawerContent === 'alarmlar' ? 'Vakit Alarmları' : 'Duyuru Paneli'}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setDrawerContent(null)} 
                    className="p-6 -mr-4 text-[var(--text-primary)]/40 hover:text-rose-500 fluid-transition relative z-[60] active:scale-90"
                  >
                    <X size={32} strokeWidth={1} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto phi-padding custom-scrollbar relative z-10">
                  <Suspense fallback={<div className="h-full flex items-center justify-center"><SplashLoader /></div>}>
                    {drawerContent === 'alarmlar' && <KrizAlarmlari />}
                    {drawerContent === 'duyurular' && <DuyuruYonetimi />}
                  </Suspense>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
