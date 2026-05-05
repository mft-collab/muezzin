import { Link, useLocation, useNavigate } from 'react-router-dom';
import React, { memo, useMemo } from 'react';
import { Home, Calendar, LayoutDashboard, User, Download, Share, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '../hooks/useRole';
import { useFcmToken } from '../hooks/useFcmToken';
import { usePWAInstall } from '../hooks/usePWAInstall';

const ALL_NAV_ITEMS = [
  { path: '/', label: 'Bugün', icon: Home, adminOnly: false },
  { path: '/takvim', label: 'Takvim', icon: Calendar, adminOnly: false },
  { path: '/profil', label: 'Profil', icon: User, adminOnly: false },
  { path: '/admin', label: 'Yönetim', icon: LayoutDashboard, adminOnly: true },
];

const NavItem = memo(({ item, isActive }: { item: typeof ALL_NAV_ITEMS[0], isActive: boolean }) => {
  const Icon = item.icon;
  const navigate = useNavigate();

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      navigate(item.path);
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
          className="absolute inset-[4px] sm:inset-0 bg-blue-950 rounded-2xl sm:rounded-full shadow-[0_4px_15px_rgba(23,37,84,0.3)]"
          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
        />
      )}
      
      <div className="relative z-20 flex flex-col items-center justify-center gap-0.5 sm:gap-1 pointer-events-none">
        <Icon 
          size={isActive ? 18 : 22} 
          className={`transition-all duration-300 ${
            isActive 
              ? 'text-white' 
              : 'text-blue-950/40'
          }`} 
        />
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.span 
              key={item.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-[0.12em] leading-none"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  if (isActive) return (
    <div className="relative flex flex-col items-center justify-center flex-1 h-full select-none touch-manipulation z-10 py-1"
    style={{ WebkitTapHighlightColor: 'transparent' }}>
      {content}
    </div>
  );
  
  return (
    <Link 
      to={item.path} 
      onPointerDown={handlePointerDown}
      className="relative flex flex-col items-center justify-center flex-1 h-full select-none touch-manipulation z-10 py-1 group"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
       {content}

      <div className="hidden sm:block absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-blue-950 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none -translate-y-2 group-hover:translate-y-0 scale-95 group-hover:scale-100 shadow-xl">
        {item.label}
        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-blue-950" />
      </div>
    </Link>
  );
});

NavItem.displayName = 'NavItem';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAdmin } = useRole();
  const { token, notificationPermissionStatus } = useFcmToken();
  const { isInstallable, isIosPrompt, install, dismissIosPrompt } = usePWAInstall();

  const navItems = useMemo(() => 
    ALL_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin),
  [isAdmin]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F7]">
      {/* Page Content */}
      <main className="flex-1 w-full pb-20 sm:pb-36 transition-all duration-300">
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
            className="fixed bottom-[84px] sm:bottom-[110px] left-1/2 -translate-x-1/2 z-[99] pointer-events-auto"
          >
            <button
              onClick={install}
              className="flex items-center gap-2.5 px-5 py-3 bg-blue-950 hover:bg-blue-900 active:scale-95 text-white text-sm font-semibold rounded-full shadow-[0_8px_30px_rgba(23,37,84,0.35)] transition-all duration-200 touch-manipulation select-none whitespace-nowrap"
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
            className="fixed bottom-[84px] sm:bottom-[110px] left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[350px] z-[99] pointer-events-auto bg-white/95 backdrop-blur-xl border border-blue-900/10 p-4 rounded-2xl shadow-[0_15px_40px_rgba(30,58,138,0.15)] flex flex-col gap-3"
          >
             <button 
               onClick={dismissIosPrompt}
               className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
             >
               <X size={16} />
             </button>
             <p className="text-sm font-semibold text-slate-800 pr-6">Uygulamayı Yükle</p>
             <p className="text-xs text-slate-600 leading-relaxed">
               Bu uygulamayı ana ekranınıza eklemek için tarayıcınızın alt kısmındaki <Share size={12} className="inline-block align-text-bottom mx-1 text-blue-600" /> <b>Paylaş</b> ikonuna dokunun, ardından <b>"Ana Ekrana Ekle"</b> seçeneğini seçin.
             </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dock Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-none flex justify-center">
        <nav className="w-full sm:w-fit sm:min-w-[450px] h-16 sm:h-20 bg-white/90 backdrop-blur-3xl border-t sm:border border-blue-950/10 sm:border-white/60 shadow-[0_-10px_40px_rgba(30,58,138,0.08)] sm:shadow-[0_20px_50px_rgba(0,0,0,0.12)] sm:rounded-full flex items-center justify-around sm:justify-center gap-0 sm:gap-4 px-0 sm:px-6 pointer-events-auto transition-all duration-500 sm:mb-8 pb-[env(safe-area-inset-bottom,0px)] sm:pb-0 touch-manipulation">
          {navItems.map((item) => (
            <NavItem 
              key={item.path} 
              item={item} 
              isActive={location.pathname === item.path} 
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

