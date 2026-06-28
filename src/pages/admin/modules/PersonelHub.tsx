import React, { useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

const MuezzinYonetimi = lazy(() => import('./MuezzinYonetimi'));
const IzinMazeretHub = lazy(() => import('./IzinMazeretHub'));

export default function PersonelHub() {
 const [searchParams, setSearchParams] = useSearchParams();
 const activeTab = searchParams.get('subtab') || 'kadro';

 const [isPending, startTransition] = useTransition();

 const setActiveTab = (subtab: string) => {
 startTransition(() => {
 setSearchParams(prev => {
 const newParams = new URLSearchParams(prev);
 newParams.set('subtab', subtab);
 return newParams;
 });
 });
 };

 const navItems = [
 { id: 'kadro', label: 'Kadro Yönetimi' },
 { id: 'mazeretler', label: 'İzin & Mazeret Kayıtları' }
 ];

 return (
 <div className="flex flex-col gap-10 relative min-h-[70vh] min-w-0 w-full max-w-full">
 
 {/* Sub-Page Navigation - Spatial Glass Pill */}
 <div className="sticky top-0 z-40 py-2">
 <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
 {navItems.map(item => {
 const isActive = activeTab === item.id;
 return (
 <motion.button
 key={item.id}
 whileHover={{ scale: 1.02, y: -1 }}
 whileTap={{ scale: 0.97 }}
 onClick={() => setActiveTab(item.id)}
 className={`px-8 py-3.5 rounded-[20px] transition-all duration-500 whitespace-nowrap text-[9px] font-bold uppercase tracking-wide relative group ${
 isActive 
 ? 'text-[var(--text-primary)]' 
 : 'text-[var(--text-primary)]/20 hover:text-[var(--text-primary)]/50 hover:bg-white/[0.02]'
 }`}
 >
 <span className="relative z-10">{item.label}</span>
 {isActive && (
 <motion.div 
 layoutId="active-subtab-pill"
 className="absolute inset-0 bg-[var(--surface-medium)] border border-[var(--glass-border)] rounded-[20px] -z-0 shadow-lg"
 transition={{ type: 'spring', stiffness: 400, damping: 30 }}
 />
 )}
 {isActive && (
 <motion.div 
 layoutId="active-subtab-indicator"
 className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[var(--dynamic-aura,var(--aura-indigo))] rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_80%,transparent)]"
 />
 )}
 </motion.button>
 );
 })}
 </div>
 </div>

 {/* Module Transition Area */}
 <div className={`relative transition-all duration-1000 ease-[0.25, 1, 0.5, 1] ${isPending ? 'opacity-20 blur-xl scale-[0.98]' : 'opacity-100 blur-0 scale-100'}`}>
 <AnimatePresence mode="wait">
 <motion.div
 key={activeTab}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
 >
 <Suspense fallback={<div className="h-[60vh] flex flex-col gap-6 w-full opacity-50"><div className="w-48 h-8 bg-[var(--text-primary)]/5 rounded-full animate-pulse" /><div className="flex-1 w-full bg-[var(--text-primary)]/[0.02] rounded-[32px] border border-[var(--glass-border)] animate-pulse spatial-glass" /></div>}>
 {activeTab === 'kadro' && <MuezzinYonetimi />}
 {activeTab === 'mazeretler' && <IzinMazeretHub />}
 </Suspense>
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
}
