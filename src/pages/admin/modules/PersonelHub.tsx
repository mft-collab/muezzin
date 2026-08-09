import React, { useTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

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
 <div className="flex flex-col gap-10 relative min-h-[70dvh] min-w-0 w-full max-w-full">
 
 {/* Sub-Page Navigation - Spatial Glass Pill */}
 <div className="sticky top-0 z-40 py-2">
 <SegmentedTabs
 items={navItems}
 activeId={activeTab}
 onChange={setActiveTab}
 ariaLabel="Personel yönetimi sekmeleri"
 idPrefix="personel"
 variant="pill"
 />
 </div>

 {/* Module Transition Area */}
 <div
 role="tabpanel"
 id={`personel-panel-${activeTab}`}
 aria-labelledby={`personel-tab-${activeTab}`}
 tabIndex={0}
 className={`relative transition-all duration-1000 ease-[0.25, 1, 0.5, 1] ${isPending ? 'opacity-20 blur-xl scale-[0.98]' : 'opacity-100 blur-0 scale-100'}`}
 >
 <AnimatePresence mode="wait">
 <motion.div
 key={activeTab}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
 >
 <Suspense fallback={<div className="h-[60vh] flex flex-col gap-6 w-full opacity-50"><div className="w-48 h-8 bg-[var(--text-primary)]/5 rounded-full animate-pulse" /><div className="flex-1 w-full bg-[var(--text-primary)]/[0.02] rounded-card border border-[var(--glass-border)] animate-pulse spatial-glass" /></div>}>
 {activeTab === 'kadro' && <MuezzinYonetimi />}
 {activeTab === 'mazeretler' && <IzinMazeretHub />}
 </Suspense>
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
}
