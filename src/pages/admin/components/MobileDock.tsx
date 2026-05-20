import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, CalendarDays, Users, Database, LogOut, Sun, Moon } from 'lucide-react';

interface MobileDockProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingIzinler: number;
  cozulmamisSayisi: number;
  onLogout: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
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
  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={22} />, badge: cozulmamisSayisi },
    { id: 'planlama', icon: <CalendarDays size={22} /> },
    { id: 'ekip', icon: <Users size={22} />, badge: pendingIzinler },
    { id: 'ayarlar', icon: <Database size={22} /> }
  ];

  return (
    <div className="lg:hidden fixed bottom-8 inset-x-0 z-[60] flex justify-center pointer-events-none px-6">
      <div className="spatial-glass px-2 py-2 rounded-[32px] flex items-center gap-1.5 shadow-[0_32px_80px_-10px_rgba(0,0,0,0.6)] pointer-events-auto border border-[var(--glass-border)] backdrop-blur-[80px] saturate-[200%]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative p-3.5 rounded-[22px] transition-all duration-500 z-10 flex flex-col items-center gap-1 group active:scale-90 ${
                isActive 
                  ? 'text-indigo-400 scale-110' 
                  : 'text-[var(--text-primary)]/30 hover:text-[var(--text-primary)]/60'
              }`}
            >
              <div className="relative z-10 transition-transform duration-500 group-active:scale-90">
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
                    className="absolute inset-0 bg-indigo-500/10 blur-xl -z-20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                  <motion.div 
                    layoutId="active-dock-indicator"
                    className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)] mt-0.5"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  />
                </>
              )}
            </button>
          );
        })}
        
        <div className="w-[1px] h-8 bg-[var(--glass-border)] mx-2" />
        
        <div className="flex items-center gap-1.5 pr-1.5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="p-3.5 rounded-[22px] text-[var(--text-primary)]/20 hover:text-indigo-400 hover:bg-[var(--text-primary)]/[0.03] transition-all"
          >
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onLogout}
            className="p-3.5 rounded-[22px] text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/5 transition-all"
          >
            <LogOut size={18} strokeWidth={1.5} />
          </motion.button>
        </div>
      </div>
    </div>
  );
});
