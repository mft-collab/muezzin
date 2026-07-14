import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Star, CheckCircle2 } from 'lucide-react';
import { parseISO } from 'date-fns';
import { GorevKarti } from './GorevKarti';
import { Bildirim, GunlukVakit } from '../types';
import { getTurkeyNow } from '../lib/dateUtils';
import { useOneShotAnimation } from '../hooks/useOneShotAnimation';

interface Props {
 loading: boolean;
 gorevler: Bildirim[];
 bugunVakitler: GunlukVakit | null;
 autoOpenMazeretId?: string | null;
 onMazeretHandled?: () => void;
}

export const KisiselGorevAkisi: React.FC<Props> = ({
 loading,
 gorevler,
 bugunVakitler,
 autoOpenMazeretId,
 onMazeretHandled
}) => {
 const shouldAnimate = useOneShotAnimation('kisisel-gorev-akisi');

 const isFriday = useMemo(() => {
 if (bugunVakitler?.tarih) {
 return parseISO(bugunVakitler.tarih).getDay() === 5;
 }
 return getTurkeyNow().getDay() === 5;
 }, [bugunVakitler?.tarih]);


 const containerVariants = {
 hidden: { opacity: 0 },
 visible: {
 opacity: 1,
 transition: {
 staggerChildren: shouldAnimate ? 0.1 : 0
 }
 }
 };

 const itemVariants = {
 hidden: { opacity: 0, y: 10 },
 visible: { 
 opacity: 1, 
 y: 0, 
 transition: { duration: shouldAnimate ? 0.5 : 0, ease: 'easeOut' }
 }
 };

 return (
 <motion.section 
 initial={shouldAnimate ? "hidden" : false}
 animate="visible"
 variants={containerVariants}
 className="px-0"
 >
 <motion.div variants={itemVariants} className="flex items-center gap-4 sm:gap-8 mb-8 sm:mb-12">
 <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-[24px] bg-[var(--text-primary)]/[0.03] flex items-center justify-center border border-[var(--glass-border)] shadow-sm ${isFriday ? 'text-emerald-400' : 'text-[var(--dynamic-aura,var(--aura-indigo))]'}`}>
 <Star size={24} className="sm:size-8" strokeWidth={1.2} />
 </div>
 <div>
 <h2 className="text-2xl sm:text-4xl font-light text-[var(--text-primary)] tracking-tight leading-none">Kişisel Görevlerim</h2>
 <p className={`authority-title text-[11px] mt-2.5 tracking-wide font-medium ${isFriday ? 'text-emerald-400/60' : 'opacity-40'}`}>BUGÜNKÜ GÖREV VE ONAY AKIŞI</p>
 </div>
 </motion.div>

 {loading ? (
 <div className="grid grid-cols-1 gap-6">
 {[1, 2].map(i => (
 <div key={i} className="skeleton-shimmer h-36 rounded-[32px] flex items-center px-8 gap-6 border border-[var(--text-primary)]/[0.04] relative overflow-hidden">
 <div className="w-12 h-12 rounded-2xl bg-[var(--text-primary)]/5" />
 <div className="flex-1 space-y-3">
 <div className="w-1/3 h-2 bg-[var(--text-primary)]/5 rounded-full" />
 <div className="w-1/2 h-3 bg-[var(--text-primary)]/5 rounded-full opacity-50" />
 </div>
 </div>
 ))}
 </div>
 ) : gorevler.length === 0 ? (
 <motion.div 
 variants={itemVariants}
 whileHover={{ y: -4, scale: 1.005 }}
 whileTap={{ scale: 0.995 }}
 transition={{ type: 'spring', stiffness: 280, damping: 24 }}
 className="spatial-glass p-8 sm:p-14 rounded-[28px] text-center relative overflow-hidden group"
 >
 <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/[0.03] via-transparent to-transparent" />
 <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-[28px] flex items-center justify-center mx-auto mb-10 border border-emerald-500/20 animate-float shadow-lg shadow-emerald-500/10">
 <CheckCircle2 size={32} strokeWidth={1.2} />
 </div>
 <h3 className="text-2xl sm:text-3xl font-light mb-5 tracking-tight text-[var(--text-primary)]">Bugün görev yok</h3>
 <p className="authority-title !text-[11px] max-w-sm mx-auto leading-relaxed mt-8 opacity-35">BUGÜN İÇİN ATANMIŞ BİR GÖREVİNİZ BULUNMAMAKTADIR.</p>
 </motion.div>
 ) : (
 <div className="grid grid-cols-1 gap-8">
 {gorevler.map((g) => (
 <motion.div key={g.id} variants={itemVariants}>
 <GorevKarti 
   bildirim={g} 
   saat={bugunVakitler ? bugunVakitler[g.vakit] : "00:00"} 
   autoOpenMazeret={autoOpenMazeretId === g.id}
   onMazeretHandled={onMazeretHandled}
 />
 </motion.div>
 ))}
 </div>
 )}
 </motion.section>
 );
};
