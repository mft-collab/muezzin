import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Megaphone, X, Calendar, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useDashboardLogic } from '../hooks/useDashboardLogic';
import { HademelerListesi } from '../components/HademelerListesi';
import { KisiselGorevAkisi } from '../components/KisiselGorevAkisi';
import { AnaEkranHero } from '../components/AnaEkranHero';
import { IslamicGeometricBg } from '../components/ui/IslamicGeometricBg';

export default function MuezzinAnaEkran() {
  const {
    gorevler,
    gorevLoading,
    bugunVakitler,
    sonraki,
    mevcutVakit,
    bugunDate,
    bugunPlan,
    asilIzinde,
    yedekIzinde,
    isHeroLoading,
    isHademelerLoading,
    auraColor,
    duyurular,
    viewingDuyuru,
    setViewingDuyuru,
    currentUser,
    getMuezzinName
  } = useDashboardLogic();

  const [activeDuyuruIdx, setActiveDuyuruIdx] = useState(0);

  const getSpiritualGreeting = () => {
    const isFriday = new Date().getDay() === 5;
    const hocaAdi = currentUser?.displayName ? currentUser.displayName.split(' ')[0] : '';
    const welcomeName = hocaAdi ? `${hocaAdi} Hocam` : 'Değerli Hocam';

    if (isFriday) {
      return 'Hayırlı Cumalar dilerim. Mihraba hizmetiniz mübarek olsun.';
    }

    if (mevcutVakit === 'sabah') {
      return `Es-selamu aleykum, ${welcomeName}. Hayırlı Sabahlar, gününüz bereketli olsun.`;
    }

    return 'Hayırlı Nöbetler dilerim. Hizmetiniz kabul olsun.';
  };

  return (
    <div className="w-full min-h-screen bg-[var(--app-bg)] relative overflow-hidden transition-colors duration-1000">
      {/* Minimal Ambient Aura */}
      <div 
        className="fixed pointer-events-none inset-0 z-0 opacity-10 transition-opacity duration-1000"
        style={{ 
          background: `radial-gradient(circle at 50% 20%, ${auraColor} 0%, transparent 70%)`
        }}
      />

      <IslamicGeometricBg />
      
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-32 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 lg:gap-12 relative z-10">
          
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 lg:sticky lg:top-8 isolate"
          >
            <AnaEkranHero 
              isLoading={isHeroLoading}
              mevcutVakit={mevcutVakit}
              sonraki={sonraki}
              bugunDate={bugunDate}
              bugunVakitler={bugunVakitler}
            />
          </motion.div>

          {/* Content Section */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 flex flex-col gap-6 sm:gap-8"
          >
             {/* Spiritual Welcome Banner */}
             <motion.div
               initial={{ opacity: 0, y: 12 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
               className="p-6 sm:p-8 spatial-glass bg-gradient-to-r from-[var(--aura-indigo)]/[0.01] to-transparent border-[var(--glass-border)] border-l-[3px] transition-all duration-1000"
               style={{ borderLeftColor: auraColor }}
             >
               <p className="premium-label !text-[8px] !opacity-30 mb-1.5 uppercase tracking-[0.25em]">HİZMET KAPISI</p>
               <h2 className="text-xl sm:text-2xl font-light text-[var(--text-primary)] leading-normal tracking-tight">
                 {getSpiritualGreeting()}
               </h2>
             </motion.div>

             {/* Announcements Slider */}
             {duyurular.length > 0 && (
               <motion.div 
                 initial={{ opacity: 0, y: 12 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                 className="spatial-glass !bg-[var(--status-info)]/[0.03] !border-[var(--status-info)]/15 p-5 sm:p-6 relative overflow-hidden group"
               >
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--status-info)]/[0.015] blur-2xl rounded-full pointer-events-none" />
                 
                 <div className="flex items-center justify-between mb-4 relative z-10">
                   <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-info)] animate-pulse" />
                     <p className="text-[8.5px] text-[var(--status-info)]/80 font-bold tracking-[0.25em] uppercase">RESMİ GÖREVLENDİRME DUYURULARI</p>
                   </div>
                   {duyurular.length > 1 && (
                     <div className="flex items-center gap-1.5 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] p-1 rounded-xl backdrop-blur-md relative z-20">
                       <button 
                         disabled={activeDuyuruIdx === 0}
                         onClick={(e) => {
                           e.stopPropagation();
                           setActiveDuyuruIdx(prev => Math.max(0, prev - 1));
                         }}
                         className={`p-1 rounded-[8px] hover:bg-white/5 transition-all flex items-center justify-center ${activeDuyuruIdx === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-80 hover:opacity-100'}`}
                       >
                         <ChevronLeft size={10} strokeWidth={2.5} />
                       </button>
                       <span className="text-[8px] font-bold text-[var(--text-secondary)]/60 px-1.5 tabular-nums">
                         {activeDuyuruIdx + 1} / {duyurular.length}
                       </span>
                       <button 
                         disabled={activeDuyuruIdx === duyurular.length - 1}
                         onClick={(e) => {
                           e.stopPropagation();
                           setActiveDuyuruIdx(prev => Math.min(duyurular.length - 1, prev + 1));
                         }}
                         className={`p-1 rounded-[8px] hover:bg-white/5 transition-all flex items-center justify-center ${activeDuyuruIdx === duyurular.length - 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-80 hover:opacity-100'}`}
                       >
                         <ChevronRight size={10} strokeWidth={2.5} />
                       </button>
                     </div>
                   )}
                 </div>

                 <AnimatePresence mode="wait">
                   <motion.div
                     key={activeDuyuruIdx}
                     initial={{ opacity: 0, x: 8 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -8 }}
                     transition={{ duration: 0.25 }}
                     onClick={() => setViewingDuyuru(duyurular[activeDuyuruIdx])}
                     className="flex items-center gap-4 sm:gap-5 cursor-pointer relative overflow-hidden group/item shimmer-trigger"
                   >
                     <div className="kinetic-sheen" />
                     <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-[16px] bg-gradient-to-br from-[var(--status-info)]/15 via-[var(--status-info)]/5 to-transparent flex items-center justify-center shrink-0 border border-[var(--status-info)]/25 group-hover/item:scale-105 group-hover/item:shadow-[0_0_15px_rgba(99,102,241,0.15)] transition-all duration-500 relative">
                       <Megaphone size={16} className="text-[var(--status-info)] group-hover/item:rotate-12 transition-transform duration-500" strokeWidth={1.75} />
                       <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--status-info)] shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <h3 className="text-base sm:text-lg font-light text-[var(--text-primary)] group-hover/item:font-normal transition-all duration-300 truncate">
                         {duyurular[activeDuyuruIdx].baslik}
                       </h3>
                       <p className="text-[9.5px] text-[var(--text-secondary)]/50 mt-0.5 line-clamp-1">
                         {duyurular[activeDuyuruIdx].icerik}
                       </p>
                     </div>
                     <ChevronRight size={16} className="text-[var(--text-secondary)]/35 group-hover/item:text-[var(--text-secondary)]/60 group-hover/item:translate-x-0.5 transition-all duration-300 shrink-0" />
                   </motion.div>
                 </AnimatePresence>
               </motion.div>
             )}

             {/* Duty Roster */}
             <motion.div
               initial={{ opacity: 0, y: 12 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
               className="spatial-glass p-4 sm:p-8"
             >
               <HademelerListesi 
                 asilIsim={getMuezzinName(bugunPlan?.asil)} 
                 yedekIsim={getMuezzinName(bugunPlan?.yedek)} 
                 planVarMi={!!bugunPlan} 
                 isAsilSizMisiniz={currentUser?.uid === bugunPlan?.asil} 
                 isYedekSizMisiniz={currentUser?.uid === bugunPlan?.yedek} 
                 asilIzinde={asilIzinde} 
                 yedekIzinde={yedekIzinde} 
                 loading={isHademelerLoading}
               />
             </motion.div>

             {/* Task Flow */}
             <motion.div
               initial={{ opacity: 0, y: 12 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.45, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
               id="gorev-akisi"
             >
               <KisiselGorevAkisi loading={gorevLoading} gorevler={gorevler} bugunVakitler={bugunVakitler} />
             </motion.div>

             {/* Bento Navigation Grid */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <motion.div
                 initial={{ opacity: 0, y: 12 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.45, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
               >
                 <Link to="/takvim" className="h-full p-6 spatial-glass hover:bg-[var(--text-primary)]/[0.015] hover:scale-[1.015] hover:border-white/10 dark:hover:border-white/15 hover:shadow-2xl transition-all duration-500 flex flex-col justify-between relative overflow-hidden shimmer-trigger group/cal">
                   <div className="kinetic-sheen" />
                   <div className="w-12 h-12 rounded-2xl bg-[var(--text-primary)]/[0.04] border border-[var(--glass-border)] flex items-center justify-center group-hover/cal:scale-105 group-hover/cal:bg-[var(--text-primary)]/[0.08] transition-all duration-500 mb-6">
                     <Calendar size={20} className="text-[var(--text-secondary)]/50 group-hover/cal:text-[var(--text-secondary)]/85 transition-colors duration-500" />
                   </div>
                   <div>
                     <h3 className="text-base sm:text-lg font-light text-[var(--text-primary)] group-hover/cal:font-normal transition-all duration-500">Haftalık Plan</h3>
                     <p className="text-[8px] text-[var(--text-secondary)]/40 mt-1.5 uppercase tracking-widest leading-none">Koordinasyon Takvimi</p>
                   </div>
                 </Link>
               </motion.div>

               <motion.div
                 initial={{ opacity: 0, y: 12 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.45, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
               >
                 <Link to="/profil" className="h-full p-6 spatial-glass hover:bg-[var(--text-primary)]/[0.015] hover:scale-[1.015] hover:border-white/10 dark:hover:border-white/15 hover:shadow-2xl transition-all duration-500 flex flex-col justify-between relative overflow-hidden shimmer-trigger group/prof">
                   <div className="kinetic-sheen" />
                   <div className="w-12 h-12 rounded-2xl bg-[var(--text-primary)]/[0.04] border border-[var(--glass-border)] flex items-center justify-center group-hover/prof:scale-105 group-hover/prof:bg-[var(--text-primary)]/[0.08] transition-all duration-500 mb-6">
                     <svg className="w-5 h-5 text-[var(--text-secondary)]/50 group-hover/prof:text-[var(--text-secondary)]/85 transition-colors duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                     </svg>
                   </div>
                   <div>
                     <h3 className="text-base sm:text-lg font-light text-[var(--text-primary)] group-hover/prof:font-normal transition-all duration-500">Müezzin Profili</h3>
                     <p className="text-[8px] text-[var(--text-secondary)]/40 mt-1.5 uppercase tracking-widest leading-none">Rozetler ve İzinler</p>
                   </div>
                 </Link>
               </motion.div>
             </div>
          </motion.div>
        </div>

        {/* Announcement Modal (Portaled) */}
        {createPortal(
          <AnimatePresence>
            {viewingDuyuru && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setViewingDuyuru(null)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                />
                <motion.div 
                  initial={{ scale: 0.9, y: 40, opacity: 0 }} 
                  animate={{ scale: 1, y: 0, opacity: 1 }} 
                  exit={{ scale: 0.9, y: 40, opacity: 0 }} 
                  className="w-full max-w-2xl spatial-glass !bg-[var(--app-bg)] border border-[var(--glass-border)] p-8 sm:p-12 rounded-[48px] shadow-2xl relative z-10 overflow-hidden"
                >
                  <div className="absolute -top-24 -right-24 w-64 h-64 pointer-events-none opacity-10" style={{ background: 'radial-gradient(circle, var(--status-info) 0%, transparent 70%)' }} />
                  
                  <div className="flex justify-between items-start mb-10 relative z-10">
                     <div className="flex flex-col gap-2">
                       <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                         <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-indigo-400">RESMİ TEBLİĞ</p>
                       </div>
                       <span className="text-[9px] opacity-30 font-medium">SAYI: {viewingDuyuru.id?.slice(0,8)?.toUpperCase() || 'BELİRSİZ'}</span>
                     </div>
                     <button onClick={() => setViewingDuyuru(null)} className="p-3 bg-[var(--text-primary)]/5 rounded-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/10 transition-all">
                       <X size={20} />
                     </button>
                  </div>

                  <h3 className="text-3xl sm:text-5xl font-light text-[var(--text-primary)] mb-8 leading-[1.1] tracking-tight relative z-10">
                    {viewingDuyuru.baslik}
                  </h3>
                  
                  <div className="max-h-[40vh] overflow-y-auto mb-12 pr-4 custom-scrollbar relative z-10">
                    <p className="text-lg sm:text-xl font-light text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                      {viewingDuyuru.icerik}
                    </p>
                  </div>

                  <motion.button 
                    whileHover={{ y: -4, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setViewingDuyuru(null)} 
                    className="w-full py-6 bg-[var(--text-primary)] text-[var(--app-bg)] rounded-[24px] text-[11px] font-bold uppercase tracking-[0.3em] hover:bg-[var(--text-primary)]/90 transition-all shadow-xl shadow-[var(--spatial-shadow)]"
                  >
                    BİLGİ EDİNİLDİ
                  </motion.button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </div>
  );
}
