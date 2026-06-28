import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, CalendarDays, Users, Database, LogOut, Sun, Moon } from 'lucide-react';
import { Logo } from '../../../components/ui/Logo';

interface SlimSidebarProps {
 activeTab: string;
 setActiveTab: (tab: string) => void;
 onLogout: () => void;
 pendingIzinler: number;
 cozulmamisSayisi: number;
 onPrefetch?: (tab: string) => void;
 theme: 'dark' | 'light';
 toggleTheme: (event?: any) => void;
}

export const SlimSidebar = React.memo<SlimSidebarProps>(({ 
 activeTab, 
 setActiveTab, 
 onLogout,
 pendingIzinler,
 cozulmamisSayisi,
 onPrefetch,
 theme,
 toggleTheme
}) => {
 const navItems = [
 { id: 'dashboard', label: 'Özet', icon: <LayoutDashboard size={18} />, badge: cozulmamisSayisi },
 { id: 'planlama', label: 'Nöbet', icon: <CalendarDays size={18} /> },
 { id: 'ekip', label: 'Ekip', icon: <Users size={18} />, badge: pendingIzinler },
 { id: 'ayarlar', label: 'Sistem', icon: <Database size={18} /> }
 ];

 return (
 <aside className="w-[88px] flex-shrink-0 flex flex-col items-center py-12 fixed inset-y-0 hidden lg:flex z-50 rounded-none border-r border-[var(--glass-border)] bg-[var(--spatial-glass-bg)] backdrop-blur-[80px] saturate-[200%] shadow-[var(--spatial-shadow)]">
 {/* Brand & Authority */}
 <div className="w-14 h-14 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] rounded-[22px] flex items-center justify-center text-[var(--text-primary)] mb-16 shadow-[var(--spatial-shadow)] group cursor-pointer transition-all duration-700 relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-tr from-[var(--dynamic-aura,var(--aura-indigo))]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
 <Logo size={28} variant="dynamic" className="text-[var(--dynamic-aura,var(--aura-indigo))] group-hover:rotate-12 transition-transform duration-700" />
 </div>

 {/* Nav Items Ecosystem */}
 <div className="flex flex-col gap-6 w-full px-4">
 {navItems.map((item) => {
 const isActive = activeTab === item.id;
 return (
 <button
 key={item.id}
 onClick={() => setActiveTab(item.id)}
 onMouseEnter={() => onPrefetch?.(item.id)}
 className={`relative flex flex-col items-center justify-center gap-2.5 w-full h-[84px] rounded-[28px] transition-all duration-700 group z-10 ${
 isActive 
 ? 'text-[var(--text-primary)] shadow-inner' 
 : 'text-[var(--text-primary)]/20 hover:text-[var(--text-primary)]/60 hover:bg-[var(--text-primary)]/[0.02]'
 }`}
 >
 <div className={`transition-all duration-700 relative z-10 ${isActive ? 'scale-110' : ''}`}>
 {React.cloneElement(item.icon as React.ReactElement, { 
 strokeWidth: isActive ? 2 : 1.5, 
 size: 22,
 className: isActive ? 'text-[var(--dynamic-aura,var(--aura-indigo))]' : ''
 })}
 </div>
 <span className={`authority-title !text-[6px] relative z-10 transition-all duration-700 font-bold tracking-wide ${isActive ? 'opacity-100 font-black' : 'opacity-30 font-medium group-hover:font-bold'}`}>
 {item.label.toUpperCase()}
 </span>

 {item.badge > 0 && (
 <div className="badge-pulse-danger -top-1 -right-1 w-4 h-4">
 {item.badge}
 </div>
 )}

 {isActive && (
 <>
 <motion.div 
 layoutId="active-slim-pill"
 className="absolute inset-0 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] rounded-[28px] -z-10 shadow-lg"
 transition={{ type: 'spring', stiffness: 400, damping: 30 }}
 />
 <motion.div 
 layoutId="active-glow"
 className="absolute inset-0 bg-[var(--dynamic-aura,var(--aura-indigo))]/5 blur-xl -z-20"
 transition={{ type: 'spring', stiffness: 400, damping: 30 }}
 />
 <motion.div 
 layoutId="active-line"
 className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[var(--dynamic-aura,var(--aura-indigo))] rounded-full shadow-[0_0_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_80%,transparent)]"
 />
 </>
 )}
 </button>
 );
 })}
 </div>

 {/* Global Actions Stack */}
 <div className="mt-auto flex flex-col gap-6 pb-12">
 <button 
 onClick={toggleTheme}
 className="w-14 h-14 flex items-center justify-center rounded-[22px] bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] text-[var(--text-primary)]/20 hover:text-[var(--dynamic-aura,var(--aura-indigo))] hover:bg-[var(--dynamic-aura,var(--aura-indigo))]/5 transition-all group relative overflow-hidden"
 >
 <div className="absolute inset-0 bg-gradient-to-br from-[var(--dynamic-aura,var(--aura-indigo))]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
 {theme === 'dark' ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
 </button>

 <button 
 onClick={onLogout}
 className="w-14 h-14 flex items-center justify-center rounded-[22px] bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] text-[var(--text-primary)]/20 hover:text-rose-500 hover:bg-rose-500/10 transition-all group"
 >
 <LogOut size={20} strokeWidth={1.5} />
 </button>
 </div>
 </aside>
 );
});
