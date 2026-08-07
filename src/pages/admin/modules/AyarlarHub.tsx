import React, { useTransition } from 'react';
import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

const EzanOnbellegi = lazy(() => import('./EzanOnbellegi'));
const SistemAyarlari = lazy(() => import('./SistemAyarlari'));
const SistemLoglari = lazy(() => import('./SistemLoglari'));

export default function AyarlarHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Aktif sekme tamamen URL'deki ?subtab= parametresinden türetilir — ayrı
  // bir state + onu senkronize eden effect gerekmiyor (tek doğruluk kaynağı
  // URL'dir; setActiveTab zaten URL'i güncelliyor, bu da bu değeri otomatik
  // günceller).
  const subtabParam = searchParams.get('subtab');
  const activeTab = subtabParam === 'onbellek' || subtabParam === 'loglar' ? subtabParam : 'ayarlar';
  const [isPending, startTransition] = useTransition();

  const setActiveTab = (tab: string) => {
    startTransition(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (tab === 'ayarlar') {
          next.delete('subtab');
        } else {
          next.set('subtab', tab);
        }
        return next;
      });
    });
  };

  const navItems = [
    { id: 'ayarlar', label: 'Dizge Ayarları' },
    { id: 'onbellek', label: 'Ezan Önbelleği' },
    { id: 'loglar', label: 'Dizge Logları' }
  ];

  return (
    <div className="flex flex-col gap-10 relative min-h-[70vh] min-w-0 w-full max-w-full">
      {/* Sub-Page Navigation - Spatial Glass Pill */}
      <div className="sticky top-0 z-40 py-2">
        <SegmentedTabs
          items={navItems}
          activeId={activeTab}
          onChange={setActiveTab}
          ariaLabel="Dizge ayarları sekmeleri"
          idPrefix="ayarlar"
          variant="pill"
        />
      </div>

      {/* Module Transition Area */}
      <div
        role="tabpanel"
        id={`ayarlar-panel-${activeTab}`}
        aria-labelledby={`ayarlar-tab-${activeTab}`}
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
              {activeTab === 'ayarlar' && <SistemAyarlari />}
              {activeTab === 'onbellek' && <EzanOnbellegi />}
              {activeTab === 'loglar' && <SistemLoglari />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
