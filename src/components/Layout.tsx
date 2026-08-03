import { Link, useLocation, useNavigate } from 'react-router-dom';
import React, { memo, useMemo } from 'react';
import { Home, Calendar, LayoutDashboard, Download, Share, X, User, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { useFcmToken } from '../hooks/useFcmToken';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { unlockAudioContext } from '../store/useNotificationStore';
import { GlobalNotifications } from './GlobalNotifications';
import { OfflineBanner } from './ui/OfflineBanner';
import { useSpecularHighlight } from '../hooks/useSpecularHighlight';
import { playClick } from '../lib/sounds';
import { telemetryService } from '../services/telemetryService';


const ALL_NAV_ITEMS = [
 { path: '/', label: 'Vakit', icon: Home, adminOnly: false, component: undefined },
 { path: '/takvim', label: 'Takvim', icon: Calendar, adminOnly: false, component: () => import('../pages/HaftalikTakvim') },
 { path: '/profil', label: 'Profil', icon: User, adminOnly: false, component: () => import('../pages/Profil') },
 { path: '/ayarlar', label: 'Ayarlar', icon: Settings, adminOnly: false, component: () => import('../pages/MuezzinAyarlari') },
 { path: '/admin', label: 'Yönetim', icon: LayoutDashboard, adminOnly: true, component: () => import('../pages/admin/AdminPanel') },
];

const NavItem = memo(({ item, isActive }: { item: typeof ALL_NAV_ITEMS[0], isActive: boolean }) => {
 const Icon = item.icon;
 const navigate = useNavigate();

  const handlePointerDown = (e: React.PointerEvent) => {
  if (e.pointerType === 'touch') {
  e.preventDefault(); // Varsayılan Link davranışını ez
  React.startTransition(() => {
  navigate(item.path);
  });
  }
  };

  const handleClick = (e: React.MouseEvent) => {
  e.preventDefault();
  playClick();
  React.startTransition(() => {
  navigate(item.path);
  });
  };

 const handlePrefetch = () => {
 if (item.component) {
 item.component();
 }
 };

 const content = (
 <motion.div 
 whileTap={{ scale: 0.85 }}
 className="relative flex flex-col items-center justify-center w-full h-full"
 >
 {isActive && (
 <motion.div 
 layoutId="activeNavIndicator"
 className="absolute inset-[6px] sm:inset-0 bg-[var(--text-primary)]/[0.06] rounded-2xl sm:rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] border transition-all duration-1000"
 style={{ 
   borderColor: 'color-mix(in srgb, var(--dynamic-aura, var(--text-primary)) 20%, transparent)',
   boxShadow: '0 0 25px -4px color-mix(in srgb, var(--dynamic-aura, var(--text-primary)) 15%, transparent)' 
 }}
 transition={{ type: "spring", bounce: 0, duration: 0.3 }}
 />
 )}
 
 <div className="relative z-20 flex flex-col items-center justify-center gap-0 sm:gap-1 pointer-events-none">
 <Icon 
 size={isActive ? 20 : 22} 
 strokeWidth={isActive ? 2.5 : 1.5}
 className={`transition-all duration-500 ${
 isActive 
 ? 'text-[var(--text-primary)]' 
 : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
 }`} 
 />
  <AnimatePresence mode="wait">
  {isActive && (
  <motion.div 
  key="active-dock-indicator"
  layoutId="active-dock-indicator"
  initial={{ opacity: 0, scale: 0 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0 }}
  className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] shadow-[0_0_8px_rgba(255,255,255,0.7)] mt-1.5"
  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
  />
  )}
  </AnimatePresence>
 </div>
 </motion.div>
 );

 
 return (
 <Link 
 to={item.path} 
 aria-label={`${item.label} sekmesi`}
 onPointerDown={handlePointerDown}
 onMouseEnter={handlePrefetch}
 onClick={handleClick}
 className="relative flex flex-col items-center justify-center flex-1 h-full select-none touch-manipulation z-10 py-1 group"
 style={{ WebkitTapHighlightColor: 'transparent' }}
 >
 {content}

 <div className="hidden sm:block absolute -top-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--app-bg)] text-[var(--text-primary)] text-2xs font-sans font-extralight tracking-wide rounded-[14px] opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none -translate-y-2 group-hover:translate-y-0 scale-90 shadow-[var(--spatial-shadow)] border border-[var(--glass-border)] backdrop-blur-xl">
 {item.label}
 <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[var(--app-bg)] rotate-45 border-r border-b border-[var(--glass-border)]" />
 </div>
 </Link>
 );
});

NavItem.displayName = 'NavItem';

export function Layout({ children }: { children: React.ReactNode }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  useSpecularHighlight();


 // Global Audio Autoplay Failsafe: Unlocks audio/speech synthesis on first interaction
 React.useEffect(() => {
 const unlockAudio = () => {
 unlockAudioContext();
 window.removeEventListener('click', unlockAudio);
 window.removeEventListener('touchstart', unlockAudio);
 };

 window.addEventListener('click', unlockAudio);
 window.addEventListener('touchstart', unlockAudio);

 return () => {
 window.removeEventListener('click', unlockAudio);
 window.removeEventListener('touchstart', unlockAudio);
 };
 }, []);

 const location = useLocation();
 const isAdmin = useAuthStore(state => state.isAdmin);
 useFcmToken();
 const { isInstallable, isIosPrompt, install, dismissIosPrompt } = usePWAInstall();

 // Yüzen dock `position: fixed` olduğu için sayfanın ortasında kaydırılan
 // kartların (ör. "SIRADAKİ GÖREVİM") üzerine biniyordu — sadece sayfa sonuna
 // padding eklemek bunu çözmüyor, çünkü sorun kaydırma SIRASINDA oluşuyor.
 // Standart çözüm: aşağı kaydırırken dock'u gizle, yukarı kaydırırken göster.
 const [navHidden, setNavHidden] = React.useState(false);
 React.useEffect(() => {
 let lastY = window.scrollY;
 let ticking = false;
 const onScroll = () => {
 if (ticking) return;
 ticking = true;
 requestAnimationFrame(() => {
 const y = window.scrollY;
 const delta = y - lastY;
 if (y < 80) {
 setNavHidden(false);
 } else if (delta > 6) {
 setNavHidden(true);
 } else if (delta < -6) {
 setNavHidden(false);
 }
 lastY = y;
 ticking = false;
 });
 };
 window.addEventListener('scroll', onScroll, { passive: true });
 return () => window.removeEventListener('scroll', onScroll);
 }, []);

 // Mouse move and leave handers for the navigation dock ambient follow-aura
 const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
 const rect = e.currentTarget.getBoundingClientRect();
 const x = e.clientX - rect.left;
 const y = e.clientY - rect.top;
 e.currentTarget.style.setProperty('--mouse-x', `${x.toFixed(1)}px`);
 e.currentTarget.style.setProperty('--mouse-y', `${y.toFixed(1)}px`);
 };

 const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
 e.currentTarget.style.setProperty('--mouse-x', '50%');
 e.currentTarget.style.setProperty('--mouse-y', '50%');
 };

 // Sayfa geçişlerini otomatik izleme (Telemetry tracking)
 React.useEffect(() => {
 const pageName = `PAGE_${location.pathname === '/' ? 'VAKIT' : location.pathname.slice(1).replace(/\//g, '_').toUpperCase()}`;
 telemetryService.logEvent({
 eventType: 'page_view',
 eventName: pageName,
 metadata: { path: location.pathname }
 });
 telemetryService.addBreadcrumb(
   `Sayfa Geçişi → ${location.pathname}`,
   'navigation',
   { page: pageName }
 );
 }, [location.pathname]);

 const navItems = useMemo(() => 
 ALL_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin),
 [isAdmin]);

 const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div ref={rootRef} className="flex flex-col min-h-screen noise-surface relative overflow-hidden transition-colors duration-[3000ms]">
      
      {/* Google Neural Expressive: Global Circadian Background Auras */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div 
          className="absolute top-[-10%] right-[-10%] w-[70%] h-[70%] blur-[180px] rounded-full opacity-[0.14] sm:opacity-[0.22] transition-all duration-[3000ms]" 
          style={{ 
            background: 'radial-gradient(circle, var(--dynamic-aura, var(--aura-amber)) 0%, transparent 70%)' 
          }}
        />
        <motion.div 
          className="absolute bottom-[-10%] left-[-10%] w-[70%] h-[70%] blur-[180px] rounded-full opacity-[0.12] sm:opacity-[0.18] transition-all duration-[3000ms]" 
          style={{ 
            background: 'radial-gradient(circle, var(--dynamic-aura-secondary, var(--aura-indigo)) 0%, transparent 70%)' 
          }}
        />
      </div>

      <OfflineBanner />
      <GlobalNotifications />
      {/* Page Content */}
      {/* PWA install/iOS banner'ları nav dock'un ÜZERİNDE ayrıca yüzen sabit
          elemanlar — görünürken alttaki içerikle (ör. AnaEkranHero vakit
          matrisi) çakışmaması için ekstra alt boşluk eklenir. */}
      <main className={`flex-1 w-full transition-all duration-300 relative z-10 ${
        isAdminRoute
          ? 'pb-0'
          : isIosPrompt
            ? 'pb-[calc(230px+env(safe-area-inset-bottom,0px))] md:pb-36'
            : isInstallable
              ? 'pb-[calc(150px+env(safe-area-inset-bottom,0px))] md:pb-36'
              : 'pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-36'
      }`}>
        {children}
      </main>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {isInstallable && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
            className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] sm:bottom-[110px] left-1/2 -translate-x-1/2 z-[99] pointer-events-auto"
          >
            <button
              onClick={install}
              className="flex items-center gap-2.5 px-5 py-3 bg-[var(--text-primary)] text-[var(--app-bg)] hover:opacity-90 text-sm font-semibold rounded-full shadow-[var(--spatial-shadow)] transition-all duration-200 touch-manipulation select-none whitespace-nowrap"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Download size={16} strokeWidth={2.5} />
              Uygulamayı Yükle
            </button>
          </motion.div>
        )}

        {isIosPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
            className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] sm:bottom-[110px] left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[350px] z-[99] pointer-events-auto bg-[var(--app-bg)]/95 backdrop-blur-xl border border-[var(--glass-border)] p-4 rounded-2xl shadow-[var(--spatial-shadow)] flex flex-col gap-3"
          >
            <button
              onClick={dismissIosPrompt}
              aria-label="Kapat"
              className="absolute top-2 right-2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full"
            >
              <X size={16} />
            </button>
            <p className="text-sm font-semibold text-[var(--text-primary)] pr-6">Uygulamayı Ana Ekrana Ekleyin</p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              iPhone cihazlarda <b>görev alarmlarını ve anlık bildirimleri sesli/yazılı alabilmek için</b> bu uygulamayı ana ekranınıza kurmanız gerekmektedir. 
              <br /><br />
              Bunun için Safari altındaki <Share size={12} className="inline-block align-text-bottom mx-1 text-[var(--status-info)]" /> <b>Paylaş</b> ikonuna dokunun, ardından aşağı kaydırıp <b>"Ana Ekrana Ekle"</b> seçeneğini seçin.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!isAdminRoute && (
        <div
          className={`fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-4 right-4 sm:left-0 sm:right-0 z-[100] pointer-events-none flex justify-center pb-0 md:pb-12 md:px-6 transition-all duration-300 ease-out ${
            navHidden ? 'opacity-0 translate-y-[calc(100%+1.5rem)]' : 'opacity-100 translate-y-0'
          }`}
        >
          <nav
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`w-full sm:w-fit md:min-w-[520px] h-[64px] sm:h-[72px] md:h-[88px] apple-glass rounded-[24px] sm:rounded-[28px] md:rounded-full flex items-center justify-around md:justify-center gap-1 sm:gap-2 md:gap-8 px-2 sm:px-6 md:px-10 transition-all duration-1000 relative group/nav ${
              navHidden ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--text-primary)]/5 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div 
              className="absolute inset-0 opacity-[0.08] pointer-events-none transition-all duration-1000" 
              style={{ background: 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), var(--dynamic-aura, var(--text-primary)), transparent 50%)' }}
            />
            
            {navItems.map((item) => (
              <NavItem 
                key={item.path} 
                item={item} 
                isActive={location.pathname === item.path} 
              />
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
