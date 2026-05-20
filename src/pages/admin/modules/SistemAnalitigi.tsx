import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, CheckCircle2, TrendingUp, Cpu, Zap, Activity, ShieldCheck } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function SistemAnalitigi({ onInceleClick }: { onInceleClick?: () => void }) {
  const [healthScore, setHealthScore] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const today = new Date();
        const days = [];
        const stats = [];
        let totalScore = 0;

        for (let i = 6; i >= 0; i--) {
          const d = subDays(today, i);
          const dateStr = format(d, 'yyyy-MM-dd');
          const dayName = format(d, 'EEEE', { locale: tr });
          days.push({ dateStr, dayName });
        }

        const startDate = days[0].dateStr;
        const endDate = days[6].dateStr;
        
        const q = query(
          collection(db, 'bildirimler'),
          where('tarih', '>=', startDate),
          where('tarih', '<=', endDate)
        );
        
        const snap = await getDocs(q);
        const allBildirimler = snap.docs.map(doc => doc.data());

        for (const { dateStr, dayName } of days) {
          const dayBildirimler = allBildirimler.filter(b => b.tarih === dateStr);
          const redSayisi = dayBildirimler.filter(b => b.durum === 'reddedildi').length;
          const dayScore = Math.max(70, 100 - (redSayisi * 5));
          
          stats.push({ day: dayName, value: dayScore });
          totalScore += dayScore;
        }

        setWeeklyData(stats);
        const finalScore = Number((totalScore / 7).toFixed(1));
        setTimeout(() => setHealthScore(finalScore), 400);
      } catch (error) {
        // Error handled
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
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
          <div className="w-14 h-14 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-xl" />
          <p className="authority-title !text-[9px] opacity-20 tracking-[0.5em] uppercase italic">MATRİS VERİLERİ ÇÖZÜMLENİYOR</p>
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
            <span className="authority-title !text-[8px] !text-emerald-400 font-bold tracking-[0.3em] uppercase">SİSTEM SAĞLIK PARAMETRELERİ • CANLI</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-light text-[var(--text-primary)] tracking-tight leading-none">
            Operasyonel <span className="text-indigo-500 italic">Analitik</span>
          </h2>
        </motion.div>


      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* CHART: Weekly Luminous Pillars */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-12 spatial-glass p-10 sm:p-12 flex flex-col justify-between min-h-[550px] relative overflow-hidden group shadow-2xl border border-white/5"
        >
          {/* Living Glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="authority-title mb-8 flex items-center gap-3 !text-[8px] opacity-40 font-bold tracking-[0.3em]">
                <Activity size={14} className="text-indigo-500" />
                DÖNEMSEL VERİMLİLİK SPEKTRUMU
              </p>
              <div className="flex items-baseline gap-6">
                <h3 className="text-9xl font-light tracking-tighter text-white leading-none">
                  {healthScore}
                </h3>
                <div className="flex flex-col">
                   <span className="text-3xl text-indigo-500/40 font-light italic leading-none">pts</span>
                   <span className="authority-title !text-[7px] text-emerald-500 mt-2 font-bold tracking-[0.2em] uppercase">STABİL</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-14 h-14 spatial-glass-elevated flex items-center justify-center text-white/20 hover:text-indigo-400 transition-all cursor-pointer border border-white/5 hover:border-indigo-500/30 shadow-xl">
                <TrendingUp size={24} strokeWidth={1} />
              </div>
            </div>
          </div>

          {/* Chart Core */}
          <div className="flex-1 flex items-end justify-between gap-4 sm:gap-10 relative px-6 mb-10 mt-12">
            {/* Background Grid Lines (Subtle) */}
            <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
              <div className="border-t border-white w-full" />
              <div className="border-t border-white w-full opacity-50" />
              <div className="border-t border-white w-full" />
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
                        className="absolute -top-16 bg-white text-black text-[10px] font-bold py-3 px-6 rounded-2xl tracking-[0.2em] shadow-[0_20px_40px_rgba(255,255,255,0.2)] z-50 whitespace-nowrap border border-white/20"
                      >
                        {data.day.toUpperCase()} • {data.value}%
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${data.value}%` }}
                    transition={{ duration: 1.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className={`w-full max-w-[56px] rounded-[22px] relative overflow-hidden transition-all duration-700 shadow-2xl ${
                      hoveredIdx === idx ? 'scale-x-110 shadow-indigo-500/20' : 'opacity-60 group-hover/col:opacity-100'
                    }`}
                  >
                    {/* Glass Pillar Core */}
                    <div className={`absolute inset-0 transition-colors duration-1000 ${
                      data.value >= 95 ? 'bg-gradient-to-t from-indigo-500/50 via-indigo-500/10 to-transparent' :
                      data.value >= 90 ? 'bg-gradient-to-t from-white/20 via-white/5 to-transparent' : 
                      'bg-gradient-to-t from-rose-500/50 via-rose-500/10 to-transparent'
                    }`} />
                    
                    {/* Top Glow Indicator */}
                    <div className={`absolute top-0 inset-x-0 h-[4px] shadow-[0_0_15px_currentColor] transition-all duration-700 ${
                      data.value >= 95 ? 'bg-indigo-400 text-indigo-400' :
                      data.value >= 90 ? 'bg-white/40 text-white/40' : 
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
                </div>
                <span className={`authority-title !text-[9px] transition-all duration-700 font-bold tracking-[0.2em] ${
                  hoveredIdx === idx ? 'text-indigo-400 opacity-100' : 'opacity-20'
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
