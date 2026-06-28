import React, { useCallback } from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, CalendarDays, Users, Database, LogOut, Sun, Moon } from 'lucide-react';
import { hapticMedium } from '../../../lib/haptic';
import { playClick } from '../../../lib/sounds';

interface MobileDockProps {
 activeTab: string;
 setActiveTab: (tab: string) => void;
 pendingIzinler: number;
 cozulmamisSayisi: number;
 onLogout: () => void;
 theme: 'dark' | 'light';
 toggleTheme: (event?: any) => void;
}

export const MobileDock = React.memo<MobileDockProps>(({ 
 activeTab, 
 setActiveTab,
 pendingIzinler,
 cozulmamisSayisi,
 onLogout,
 theme,
 toggleTheme
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

 const navItems = [
 { id: 'dashboard', icon: <LayoutDashboard size={22} />, badge: cozulmamisSayisi },
 { id: 'planlama', icon: <CalendarDays size={22} /> },
 { id: 'ekip', icon: <Users size={22} />, badge: pendingIzinler },
 { id: 'ayarlar', icon: <Database size={22} /> }
 ];

 return (
 <div className="lg:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-4 z-[120] flex justify-center pointer-events-none max-w-full pb-0">
 <div className="apple-glass w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 rounded-[24px] sm:rounded-[32px] flex items-center justify-between sm:justify-center gap-1 sm:gap-1.5 pointer-events-auto touch-manipulation select-none max-w-full overflow-x-auto no-scrollbar">
 {navItems.map((item) => {
 const isActive = activeTab === item.id;
 return (
 <button
 type="button"
 key={item.id}
 aria-label={item.id}
 onPointerDown={(event) => handlePointerAction(event, () => setActiveTab(item.id))}
 onClick={() => { playClick(); setActiveTab(item.id); }}
 className={`relative flex-1 sm:flex-none min-w-[44px] min-h-[44px] sm:min-w-[54px] sm:min-h-[54px] p-2 sm:p-3.5 rounded-[18px] sm:rounded-[22px] transition-all duration-150 z-10 flex flex-col items-center justify-center gap-1 group touch-manipulation ${
 isActive 
 ? 'text-[var(--dynamic-aura,var(--aura-indigo))] scale-110' 
 : 'text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60'
 }`}
 >
 <div className="relative z-10 transition-transform duration-500 group-">
 {React.cloneElement(item.icon as React.ReactElement, { 
 strokeWidth: isActive ? 2 : 1.5,
 size: 20
 })}
 {item.badge > 0 && (
 <div className="badge-pulse-danger -top-2 -right-2 w-3.5 h-3.5 !text-[6px]">
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
 
 <div className="w-[1px] h-6 sm:h-8 bg-[var(--glass-border)] mx-0.5 sm:mx-2 shrink-0" />
 
 <div className="flex items-center gap-0.5 sm:gap-1.5 pr-0.5 sm:pr-1.5 shrink-0">
 <motion.button
 type="button"
 aria-label={theme === 'dark' ? "Aydınlık temaya geç" : "Karanlık temaya geç"}
 whileTap={{ scale: 0.9 }}
 onPointerDown={(event) => handlePointerAction(event, () => toggleTheme(event))}
 onClick={(e) => { playClick(); toggleTheme(e); }}
 className="min-w-[44px] min-h-[44px] sm:min-w-[50px] sm:min-h-[50px] p-2 sm:p-3.5 rounded-[16px] sm:rounded-[22px] text-[var(--text-primary)]/20 hover:text-[var(--dynamic-aura,var(--aura-indigo))] hover:bg-[var(--text-primary)]/[0.03] transition-all duration-150 touch-manipulation flex items-center justify-center"
 >
 {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
 </motion.button>

 <motion.button
 type="button"
 aria-label="Oturumu kapat"
 whileTap={{ scale: 0.9 }}
 onPointerDown={(event) => handlePointerAction(event, onLogout, true)}
 onClick={() => { hapticMedium(); onLogout(); }}
 className="min-w-[44px] min-h-[44px] sm:min-w-[50px] sm:min-h-[50px] p-2 sm:p-3.5 rounded-[16px] sm:rounded-[22px] text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/5 transition-all duration-150 touch-manipulation flex items-center justify-center"
 >
 <LogOut size={18} strokeWidth={1.5} />
 </motion.button>
 </div>
 </div>
 </div>
 );
});
