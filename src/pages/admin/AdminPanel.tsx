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
 <div className="w-16 h-16 bg-[var(--status-error)]/10 rounded-[24px] flex items-center justify-center mb-6 mx-auto border border-[var(--status-error)]/20 shadow-[var(--spatial-shadow)]">
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
 className="w-full py-4 bg-[var(--dynamic-aura,var(--aura-indigo))] hover:opacity-90 text-white border border-[var(--dynamic-aura,var(--aura-indigo))]/60 rounded-xl font-bold text-[9px] uppercase tracking-wide shadow-[0_10px_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_20%,transparent)] transition-all"
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

  const setActiveTab = (tab: string, subtab?: string) => {
    startTransition(() => {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.set('tab', tab);
        if (subtab) {
          newParams.set('subtab', subtab);
        } else {
          newParams.delete('subtab');
        }
        newParams.delete('sub');
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
 const muezzinlerLength = useMuezzinStore(s => s.muezzinler.filter(m => (m as any).arsivlendi !== true).length);
 const { cozulmamisSayisi } = useKrizAlarmlari();
 const [pendingIzinler, setPendingIzinler] = useState(0);

 // Sirkadiyen Aura Entegrasyonu
 const { bugunVakitler } = useEzanVakitleri();
 const mevcutVakit = useMevcutVakit(bugunVakitler);

 useEffect(() => {
 const sub = searchParams.get('sub');
 if (sub === 'alarmlar' || sub === 'duyurular') {
 setDrawerContent(sub);
 }
 }, [searchParams]);

 const closeDrawer = () => {
 setDrawerContent(null);
 setSearchParams(prev => {
 const newParams = new URLSearchParams(prev);
 newParams.delete('sub');
 return newParams;
 });
 };

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
 
 if (mounted) {
 setPendingIzinler(izinSnap.data().count);
 sessionStorage.setItem('admin_pendingIzinler', izinSnap.data().count.toString());
 sessionStorage.setItem('admin_activeDuyurular', '0');
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

 // authLoading is handled by AuthGuard. No need to flash a SplashLoader inside the layout.
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
  <Suspense fallback={<div className="h-[280px] w-full fluid-skeleton" />}>
    <SistemAnalitigi onInceleClick={() => setActiveTab('planlama')} />
  </Suspense>
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
 <div 
   style={{ '--dynamic-aura': activeAuraColor } as React.CSSProperties}
   className="min-h-screen flex lg:flex-row bg-[var(--app-bg)] font-apple pb-24 lg:pb-0 overflow-hidden selection:bg-[var(--dynamic-aura,var(--aura-indigo))]/20 fluid-transition"
 >
 
 {/* Dynamic Ambient Auras (Sirkadiyen Geçiş) */}
 <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
 <div 
 className="absolute top-[10%] left-[-15%] w-[60%] h-[60%] blur-[200px] rounded-full animate-aura transition-all duration-[3000ms]" 
 style={{ 
 background: `radial-gradient(circle, ${activeAuraColor} 0%, transparent 70%)` 
 }}
 />
 <div 
 className="absolute bottom-[10%] right-[-15%] w-[60%] h-[60%] blur-[200px] rounded-full animate-aura transition-all duration-[3000ms]" 
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
 <main className="flex-1 min-w-0 w-full max-w-full lg:ml-[80px] px-2 pt-3 pb-28 sm:pb-32 lg:pb-8 lg:p-8 relative z-10">
 <AnimatePresence mode="wait">
 <motion.div 
 key={activeTab}
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -15 }}
 transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
 className="fluid-wrapper"
 >
 {/* Authority Header */}
 <header className="mb-5 lg:mb-8 px-1 sm:px-0">
 <h1 className={`text-xl sm:text-2xl lg:text-3xl font-light text-[var(--text-primary)] tracking-tight leading-none fluid-transition group-hover:font-bold duration-700 ${isPending ? 'opacity-20 blur-sm' : 'opacity-100'}`}>
 {pageTitle}
 </h1>
 </header>

 <div className={`spatial-glass-flat p-3 sm:p-4 lg:p-6 min-h-[70vh] fluid-transition ${isPending ? 'scale-[0.99] opacity-60' : 'scale-100'} !rounded-[24px] sm:!rounded-[28px] lg:!rounded-[32px]`}>
 <ErrorBoundary FallbackComponent={AdminTabFallback} onReset={() => setSearchParams(prev => prev)}>
  <Suspense fallback={<div className="h-[60vh] flex flex-col gap-6 w-full opacity-50"><div className="w-48 h-8 bg-[var(--text-primary)]/5 rounded-full animate-pulse" /><div className="flex-1 w-full bg-[var(--text-primary)]/[0.02] rounded-[32px] border border-[var(--glass-border)] animate-pulse spatial-glass" /></div>}>
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
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/40 dark:bg-black/85 backdrop-blur-[30px]"
          >
            {/* Drawer Ambient Aura */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none transition-all duration-1000" 
              style={{ background: 'radial-gradient(circle at 100% 50%, var(--dynamic-aura, var(--aura-indigo)), transparent 60%)' }}
            />
          </motion.div>
          
          <motion.div
            drag="x"
            dragConstraints={{ left: 0 }}
            dragElastic={{ left: 0.02, right: 0.85 }}
            onDragEnd={(e, info) => {
              if (info.offset.x > 150 || info.velocity.x > 450) {
                closeDrawer();
              }
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="relative w-full md:w-[700px] lg:w-[900px] bg-[var(--app-bg)] shadow-[var(--spatial-shadow)] flex flex-col h-[100dvh] border-l border-[var(--glass-border)]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Grab Handle for swipe dismissal */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-[4px] h-16 bg-[var(--text-primary)]/10 rounded-full hidden md:block pointer-events-none" />

            <div className="flex items-center justify-between phi-padding spatial-glass rounded-none border-b border-[var(--glass-border)] relative z-50">
              <div>
                <h2 className="text-3xl font-light text-[var(--text-primary)] tracking-tight">
                  {drawerContent === 'alarmlar' ? 'Vakit Alarmları' : 'Duyuru Paneli'}
                </h2>
              </div>
              <button 
                onClick={closeDrawer} 
                className="w-12 h-12 flex items-center justify-center bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] hover:text-rose-500 rounded-[20px] border border-[var(--glass-border)] transition-all text-[var(--text-primary)]"
              >
                <X size={20} strokeWidth={1} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto phi-padding no-scrollbar relative z-10">
              <Suspense fallback={<div className="h-full flex flex-col gap-6 w-full opacity-50 pt-4"><div className="w-32 h-6 bg-[var(--text-primary)]/5 rounded-full animate-pulse" /><div className="flex-1 w-full bg-[var(--text-primary)]/[0.02] rounded-[32px] border border-[var(--glass-border)] animate-pulse spatial-glass" /></div>}>
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
