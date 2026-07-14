import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { hapticMedium } from '../../../lib/haptic';
import { playClick } from '../../../lib/sounds';
import { getAdminNavItems, APP_LINKS } from '../config/navConfig';

interface MobileDockProps {
 activeTab: string;
 setActiveTab: (tab: string) => void;
 pendingIzinler: number;
 cozulmamisSayisi: number;
 onNavigateApp: (path: string) => void;
}

export const MobileDock = React.memo<MobileDockProps>(({ 
 activeTab, 
 setActiveTab,
 pendingIzinler,
 cozulmamisSayisi,
 onNavigateApp
}) => {
 const handlePointerAction = useCallback((
  event: React.PointerEvent<HTMLButtonElement>,
  action: () => void,
  isMedium = false
  ) => {
  if (event.pointerType === 'mouse') return;
  event.preventDefault();
  if (isMedium) {
    hapticMedium();
  } else {
    playClick();
  }
  action();
  }, []);

 const navItems = getAdminNavItems({ cozulmamisSayisi, pendingIzinler });
 const appLinks = APP_LINKS;

 return (
 <div className="lg:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-4 z-[120] flex flex-col items-center gap-2 pointer-events-none max-w-full pb-0">
 <nav aria-label="Müezzin menüsü" className="apple-glass px-2 py-1 rounded-[18px] grid grid-cols-4 gap-1 pointer-events-auto touch-manipulation select-none">
 {appLinks.map((item) => (
 <button
 type="button"
 key={item.path}
 aria-label={`${item.label} sayfasına git`}
 title={item.label}
 onPointerDown={(event) => handlePointerAction(event, () => onNavigateApp(item.path))}
 onClick={() => { playClick(); onNavigateApp(item.path); }}
 className="min-w-[42px] h-[38px] px-2 rounded-[14px] flex items-center justify-center text-[var(--text-primary)]/45 hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.04] transition-all touch-manipulation"
 >
 <item.icon size={16} strokeWidth={1.7} />
 </button>
 ))}
 </nav>
 <nav aria-label="Admin ana menü" className="apple-glass w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 rounded-[22px] sm:rounded-[28px] grid grid-cols-4 gap-1 sm:gap-1.5 pointer-events-auto touch-manipulation select-none max-w-full">
 {navItems.map((item) => {
 const isActive = activeTab === item.id;
 return (
 <button
 type="button"
 key={item.id}
 aria-label={item.fullLabel}
 aria-current={isActive ? 'page' : undefined}
 onPointerDown={(event) => handlePointerAction(event, () => setActiveTab(item.id))}
 onClick={() => { playClick(); setActiveTab(item.id); }}
 title={item.fullLabel}
 className={`relative min-w-[44px] min-h-[44px] sm:min-w-[54px] sm:min-h-[54px] p-2 sm:p-3 rounded-[16px] sm:rounded-[20px] transition-all duration-150 z-10 flex flex-col items-center justify-center gap-1 group touch-manipulation ${
 isActive 
 ? 'text-[var(--dynamic-aura,var(--aura-indigo))] scale-110' 
 : 'text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60'
 }`}
 >
 <div className="relative z-10 transition-transform duration-500">
 <item.icon strokeWidth={isActive ? 2 : 1.5} size={20} />
 {item.badge > 0 && (
 <div className="badge-pulse-danger -top-2 -right-2 w-3.5 h-3.5 !text-[11px]">
 {item.badge}
 </div>
 )}
 </div>
 
 {isActive && (
 <>
 <motion.div 
 layoutId="active-dock-tab"
 className="absolute inset-0 bg-[var(--surface-medium)] rounded-[22px] -z-10 border border-[var(--glass-border)]"
 transition={{ type: 'spring', stiffness: 400, damping: 30 }}
 />
 <motion.div 
 layoutId="active-dock-glow"
 className="absolute inset-0 bg-[var(--dynamic-aura,var(--aura-indigo))]/10 blur-xl -z-20"
 transition={{ type: 'spring', stiffness: 400, damping: 30 }}
 />
 <motion.div 
 layoutId="active-dock-indicator"
 className="w-1 h-1 rounded-full bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_8px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_80%,transparent)] mt-0.5"
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 />
 </>
 )}
 </button>
 );
 })}
 </nav>
 </div>
 );
});
