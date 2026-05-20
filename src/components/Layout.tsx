import { Link, useLocation, useNavigate } from 'react-router-dom';
import React, { memo, useMemo } from 'react';
import { Home, Calendar, LayoutDashboard, Download, Share, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { useFcmToken } from '../hooks/useFcmToken';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useThemeStore } from '../store/useThemeStore';
import { GlobalNotifications } from './GlobalNotifications';

const ALL_NAV_ITEMS = [
  { path: '/', label: 'Vakit', icon: Home, adminOnly: false, component: undefined },
  { path: '/takvim', label: 'Takvim', icon: Calendar, adminOnly: false, component: () => import('../pages/HaftalikTakvim') },
  { path: '/admin', label: 'Yönetim', icon: LayoutDashboard, adminOnly: true, component: () => import('../pages/admin/AdminPanel') },
];

const NavItem = memo(({ item, isActive }: { item: typeof ALL_NAV_ITEMS[0], isActive: boolean }) => {
  const Icon = item.icon;
  const navigate = useNavigate();

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      navigate(item.path);
    }
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
          className="absolute inset-[6px] sm:inset-0 bg-[var(--text-primary)]/[0.07] border border-[var(--text-primary)]/10 rounded-2xl sm:rounded-full shadow-[0_0_20px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.1)]"
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
            <motion.span 
              key={item.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-[8px] sm:text-[10px] font-sans font-bold text-[var(--text-primary)]/90 tracking-[0.1em] mt-1 uppercase"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  
  return (
    <Link 
      to={item.path} 
      onPointerDown={handlePointerDown}
      onMouseEnter={handlePrefetch}
      className="relative flex flex-col items-center justify-center flex-1 h-full select-none touch-manipulation z-10 py-1 group"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
       {content}

      <div className="hidden sm:block absolute -top-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--app-bg)] text-[var(--text-primary)] text-[10px] font-sans font-extralight tracking-wide rounded-[14px] opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none -translate-y-2 group-hover:translate-y-0 scale-90 group-hover:scale-100 shadow-2xl border border-[var(--glass-border)] backdrop-blur-xl">
        {item.label}
        <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[var(--app-bg)] rotate-45 border-r border-b border-[var(--glass-border)]" />
      </div>
    </Link>
  );
});

NavItem.displayName = 'NavItem';

export function Layout({ children }: { children: React.ReactNode }) {
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mouse-x', `${x}%`);
      document.documentElement.style.setProperty('--mouse-y', `${y}%`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Global Audio Autoplay Failsafe: Unlocks audio/speech synthesis on first interaction
  React.useEffect(() => {
    const unlockAudio = () => {
      import('../store/useNotificationStore').then(({ unlockAudioContext }) => {
        unlockAudioContext();
      });
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

  // Sayfa geçişlerini otomatik izleme (Telemetry tracking)
  React.useEffect(() => {
    import('../services/telemetryService').then(({ telemetryService }) => {
      telemetryService.logEvent({
        eventType: 'page_view',
        eventName: `PAGE_${location.pathname === '/' ? 'VAKIT' : location.pathname.slice(1).replace(/\//g, '_').toUpperCase()}`,
        metadata: { path: location.pathname }
      });
    });
  }, [location.pathname]);

  const navItems = useMemo(() => 
    ALL_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin),
  [isAdmin]);

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div ref={rootRef} className="flex flex-col min-h-screen noise-surface">
      <GlobalNotifications />
      {/* Page Content */}
      <main className={`flex-1 w-full transition-all duration-300 ${isAdminRoute ? 'pb-0' : 'pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-36'}`}>
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
              className="flex items-center gap-2.5 px-5 py-3 bg-[var(--text-primary)] text-[var(--app-bg)] hover:opacity-90 active:scale-95 text-sm font-semibold rounded-full shadow-[var(--spatial-shadow)] transition-all duration-200 touch-manipulation select-none whitespace-nowrap"
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
        <div className="fixed bottom-6 left-0 right-0 z-[100] pointer-events-none flex justify-center pb-[env(safe-area-inset-bottom,0px)] md:pb-12 md:px-6">
          <nav 
            className="w-[98%] sm:w-fit md:min-w-[520px] h-18 md:h-22 spatial-glass rounded-[28px] md:rounded-full flex items-center justify-around md:justify-center gap-1 sm:gap-2 md:gap-8 px-2 sm:px-6 md:px-10 pointer-events-auto transition-all duration-1000 relative overflow-hidden group/nav shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--text-primary)]/5 to-transparent opacity-0 group-hover/nav:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),var(--text-primary),transparent_50%)] opacity-5 pointer-events-none" />
            
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
