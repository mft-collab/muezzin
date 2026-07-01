import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function SistemAnalitigi({ onInceleClick }: { onInceleClick?: () => void }) {
  const [healthScore, setHealthScore] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; value: number; completed: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date();
    const days: { dateStr: string; dayName: string }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      days.push({
        dateStr: format(d, 'yyyy-MM-dd'),
        dayName: format(d, 'EEEE', { locale: tr }),
      });
    }

    const startDate = days[0].dateStr;
    const endDate = days[6].dateStr;

    const q = query(
      collection(db, 'bildirimler'),
      where('tarih', '>=', startDate),
      where('tarih', '<=', endDate)
    );

    // Gerçek zamanlı dinleyici: getDocs yerine onSnapshot kullanılıyor
    const unsubscribe = onSnapshot(q, (snap) => {
      const allBildirimler = snap.docs.map(doc => doc.data());
      const stats: { day: string; value: number; completed: number; total: number }[] = [];
      let totalScore = 0;
      let validDays = 0;

      for (const { dateStr, dayName } of days) {
        const dayBildirimler = allBildirimler.filter(b => b.tarih === dateStr);

        // Yalnızca asil görevleri sayıyoruz — bunlar operasyonel tamamlanma ölçütü
        const asilGorevler = dayBildirimler.filter(b => b.tip === 'asil');
        const tamamlananlar = asilGorevler.filter(
          b => b.durum === 'onaylandi' || b.durum === 'okundu_varsayilan' || b.durum === 'sistem_atadi'
        );
        const reddedilenler = asilGorevler.filter(b => b.durum === 'reddedildi');

        let dayScore: number;
        if (asilGorevler.length === 0) {
          // O gün için plan yoksa —skoru geçersiz say, ortalamanın dışında tut
          dayScore = -1;
        } else {
          const completionRate = (tamamlananlar.length / asilGorevler.length) * 100;
          // Reddedilen her görev 3 puan düşürür, minimum 0
          dayScore = Math.max(0, Math.round(completionRate - (reddedilenler.length * 3)));
        }

        stats.push({
          day: dayName,
          value: dayScore >= 0 ? dayScore : 0,
          completed: tamamlananlar.length,
          total: asilGorevler.length,
        });

        if (dayScore >= 0) {
          totalScore += dayScore;
          validDays++;
        }
      }

      setWeeklyData(stats);
      const finalScore = validDays > 0 ? Number((totalScore / validDays).toFixed(1)) : 0;
      setTimeout(() => setHealthScore(finalScore), 400);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring", stiffness: 400, damping: 30 }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="flex flex-col items-center gap-8">
          <div className="w-14 h-14 border-4 border-[var(--dynamic-aura,var(--aura-indigo))]/10 border-t-[var(--dynamic-aura,var(--aura-indigo))] rounded-full animate-spin shadow-[var(--spatial-shadow)]" />
          <p className="authority-title !text-[9px] opacity-20 tracking-wide uppercase italic">MATRİS VERİLERİ ÇÖZÜMLENİYOR</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-12"
    >
      {/* HEADER: High Authority Context */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
            <span className="authority-title !text-[8px] !text-emerald-400 font-bold tracking-wide uppercase">SİSTEM SAĞLIK PARAMETRELERİ • CANLI</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-light text-[var(--text-primary)] tracking-tight leading-none">
            Operasyonel <span className="text-[var(--dynamic-aura,var(--aura-indigo))] italic">Analitik</span>
          </h2>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* CHART: Weekly Luminous Pillars */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-12 spatial-glass p-10 sm:p-12 flex flex-col justify-between min-h-[550px] relative overflow-hidden group shadow-[var(--spatial-shadow)] border border-white/5"
        >
          {/* Living Glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--dynamic-aura,var(--aura-indigo))]/20 to-transparent" />
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="authority-title mb-8 flex items-center gap-3 !text-[8px] opacity-40 font-bold tracking-wide">
                <Activity size={14} className="text-[var(--dynamic-aura,var(--aura-indigo))]" />
                DÖNEMSEL VERİMLİLİK SPEKTRUMU — GÖREVLERİN TAMAMLANMA ORANI
              </p>
              <div className="flex items-baseline gap-6">
                <h3 className="text-9xl font-light tracking-tighter text-[var(--text-primary)] leading-none">
                  {healthScore}
                </h3>
                <div className="flex flex-col">
                  <span className="text-3xl text-[var(--dynamic-aura,var(--aura-indigo))]/40 font-light italic leading-none">%</span>
                  <span className={`authority-title !text-[7px] mt-2 font-bold tracking-wide uppercase ${
                    healthScore >= 80 ? 'text-emerald-500' :
                    healthScore >= 60 ? 'text-amber-500' :
                    healthScore > 0 ? 'text-rose-500' : 'text-[var(--text-secondary)]/30'
                  }`}>
                    {healthScore >= 80 ? 'STABİL' : healthScore >= 60 ? 'İZLEME' : healthScore > 0 ? 'KRİTİK' : 'VERİ YOK'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Core */}
          <div className="flex-1 flex items-end justify-between gap-4 sm:gap-10 relative px-6 mb-10 mt-12">
            {/* Background Grid Lines (Subtle) */}
            <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none opacity-[0.06]">
              <div className="border-t border-[var(--text-primary)] w-full" />
              <div className="border-t border-[var(--text-primary)] w-full opacity-50" />
              <div className="border-t border-[var(--text-primary)] w-full" />
            </div>

            {weeklyData.map((data, idx) => (
              <div 
                key={idx} 
                className="flex-1 flex flex-col items-center gap-10 z-10 group/col relative"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="w-full h-64 flex items-end justify-center">
                  <AnimatePresence>
                    {hoveredIdx === idx && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="absolute -top-16 bg-[var(--surface-medium)] text-[var(--text-primary)] border border-[var(--glass-border)] text-[10px] font-bold py-3 px-6 rounded-2xl tracking-wide shadow-[var(--spatial-shadow)] z-50 whitespace-nowrap"
                      >
                        {data.day.toUpperCase()} •{' '}
                        {data.total > 0
                          ? `${data.completed}/${data.total} görev — %${data.value}`
                          : 'Plan yok'}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {data.total > 0 ? (
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(data.value, 4)}%` }}
                      transition={{ duration: 1.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className={`w-full max-w-[56px] rounded-[22px] relative overflow-hidden transition-all duration-700 shadow-[var(--spatial-shadow)] ${
                        hoveredIdx === idx ? 'scale-x-110 ' : 'opacity-60 group-hover/col:opacity-100'
                      }`}
                    >
                      {/* Glass Pillar Core */}
                      <div className={`absolute inset-0 transition-colors duration-1000 ${
                        data.value >= 80 ? 'bg-gradient-to-t from-[var(--dynamic-aura,var(--aura-indigo))]/50 via-[var(--dynamic-aura,var(--aura-indigo))]/10 to-transparent' :
                        data.value >= 60 ? 'bg-gradient-to-t from-amber-500/50 via-amber-500/10 to-transparent' : 
                        'bg-gradient-to-t from-rose-500/50 via-rose-500/10 to-transparent'
                      }`} />
                      
                      {/* Top Glow Indicator */}
                      <div className={`absolute top-0 inset-x-0 h-[4px] shadow-[0_0_15px_currentColor] transition-all duration-700 ${
                        data.value >= 80 ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-[var(--dynamic-aura,var(--aura-indigo))]' :
                        data.value >= 60 ? 'bg-amber-400 text-amber-400' : 
                        'bg-rose-400 text-rose-400'
                      }`} />

                      {/* Aura Animation (Hover) */}
                      {hoveredIdx === idx && (
                        <motion.div 
                          layoutId="aura"
                          className="absolute inset-0 bg-white/5 pointer-events-none"
                        />
                      )}
                    </motion.div>
                  ) : (
                    // Plan olmayan günler için minimal gösterge
                    <div className="w-full max-w-[56px] h-[4px] rounded-full bg-white/5" />
                  )}
                </div>
                <span className={`authority-title !text-[9px] transition-all duration-700 font-bold tracking-wide ${
                  hoveredIdx === idx ? 'text-[var(--dynamic-aura,var(--aura-indigo))] opacity-100' : 'opacity-20'
                }`}>
                  {data.day.substring(0, 3).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
