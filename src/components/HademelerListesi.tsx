import React, { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Users, AlertCircle } from 'lucide-react';
import { useVakitStore } from '../store/useVakitStore';
import { GorevliKarti } from './GorevliKarti';

interface Props {
  asilIsim?: string;
  yedekIsim?: string;
  asilDurum?: 'bekliyor' | 'onaylandi' | 'reddedildi';
  yedekDurum?: 'bekliyor' | 'onaylandi' | 'reddedildi';
  planVarMi: boolean;
  isAsilSizMisiniz?: boolean;
  isYedekSizMisiniz?: boolean;
  asilIzinde?: boolean;
  yedekIzinde?: boolean;
  asilSabitIzinde?: boolean;
  yedekSabitIzinde?: boolean;
  loading?: boolean;
}

export const HademelerListesi = React.memo(({
  asilIsim,
  yedekIsim,
  asilDurum,
  yedekDurum,
  planVarMi,
  isAsilSizMisiniz,
  isYedekSizMisiniz,
  asilIzinde,
  yedekIzinde,
  asilSabitIzinde,
  yedekSabitIzinde,
  loading,
}: Props) => {
  const dateKey = useVakitStore(s => s.dateKey);
  const isFriday = useMemo(() => new Date(dateKey).getDay() === 5, [dateKey]);

  const hasAnimated = useRef(false);
  const motionInitial   = hasAnimated.current ? false : { opacity: 0, y: 16 };
  const motionAnimate   = { opacity: 1, y: 0 };
  const motionTransition = hasAnimated.current ? undefined : { duration: 0.4, ease: 'easeOut' as const };
  
  React.useEffect(() => {
    hasAnimated.current = true;
  }, []);

  return (
    <motion.section
      initial={motionInitial}
      animate={motionAnimate}
      transition={motionTransition}
      className="w-full"
    >
      {/* ── Başlık ── */}
      <div className="flex items-center gap-4 sm:gap-10 mb-8 sm:mb-16">
        <div
          className={`w-14 h-14 sm:w-20 sm:h-20 rounded-[28px] bg-white/[0.03] flex items-center justify-center border border-white/5 shadow-2xl relative group ${
            isFriday ? 'text-emerald-400' : 'text-indigo-400'
          }`}
        >
          <Users
            size={28}
            className="sm:size-10 group-hover:scale-110 transition-transform duration-700"
            strokeWidth={1}
          />
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity scale-150 pointer-events-none"
            style={{ background: `radial-gradient(circle, ${isFriday ? 'rgba(16,185,129,1)' : 'rgba(99,102,241,1)'} 0%, transparent 70%)` }}
          />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2 sm:mb-3">
            <div
              className={`w-1.5 h-1.5 rounded-full shadow-[0_0_10px_currentColor] ${
                isFriday ? 'bg-emerald-400 text-emerald-400' : 'bg-indigo-500 text-indigo-500'
              }`}
            />
            <p className="authority-title text-[7px] sm:text-[9px] opacity-30 tracking-[0.4em] font-bold uppercase">
              {isFriday ? 'CUMA NAMAZI KOORDİNASYON MASASI' : 'PERSONEL KOORDİNASYON MASASI'}
            </p>
          </div>
          <h2 className="text-3xl sm:text-5xl font-light text-[var(--text-primary)] tracking-tight leading-none">
            {isFriday ? 'Makam' : 'Vakit'}{' '}
            <span className={`${isFriday ? 'text-emerald-400' : 'text-indigo-500'} italic`}>
              {isFriday ? 'Muhafızları' : 'Görevlileri'}
            </span>
          </h2>
        </div>
      </div>

      {/* ── İçerik ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-10">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="skeleton-shimmer h-[9.5rem] flex items-center px-8 gap-6 !rounded-[40px] border border-white/[0.04]"
            >
              <div className="w-16 h-16 rounded-[24px] bg-white/5 shrink-0" />
              <div className="flex-1 space-y-4">
                <div className="w-1/3 h-2 bg-white/5 rounded-full" />
                <div className="w-2/3 h-5 bg-white/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : planVarMi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-10">
          <GorevliKarti 
            tip="asil"
            isim={asilIsim}
            durum={asilDurum}
            isUser={isAsilSizMisiniz}
            izinde={asilIzinde || asilSabitIzinde}
            isFriday={isFriday}
          />
          <GorevliKarti 
            tip="yedek"
            isim={yedekIsim}
            durum={yedekDurum}
            isUser={isYedekSizMisiniz}
            izinde={yedekIzinde || yedekSabitIzinde}
            isFriday={isFriday}
          />
        </div>
      ) : (
        <div className="p-16 sm:p-24 spatial-glass text-center flex flex-col items-center justify-center gap-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/[0.02] via-transparent to-transparent pointer-events-none" />
          <div className="w-20 h-20 rounded-[32px] bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shadow-inner animate-float">
            <AlertCircle
              size={36}
              className="text-white/15"
              strokeWidth={1}
            />
          </div>
          <div className="max-w-md relative z-10">
            <p className="authority-title !text-[9px] opacity-20 tracking-[0.5em] mb-3 uppercase">
              Veri Akışı Kesildi
            </p>
            <p className="text-lg font-extralight text-white/25 italic leading-relaxed">
              Bu periyot için henüz bir operasyonel görevlendirme yapılmamıştır.
            </p>
          </div>
        </div>
      )}
    </motion.section>
  );
});
