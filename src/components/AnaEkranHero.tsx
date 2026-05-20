import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './ui/Logo';
import { LiveClock } from './LiveClock';
import { GeriSayim } from './GeriSayim';
import { getTurkeyNow, parseVakitToDate, getHijriDate } from '../lib/dateUtils';
import { GunlukVakit, Vakit } from '../types';

interface AnaEkranHeroProps {
  isLoading: boolean;
  mevcutVakit: Vakit | null;
  sonraki: {
    vakit: Vakit;
    ezanSaati: Date;
  } | null;
  bugunDate: Date;
  bugunVakitler: GunlukVakit | null;
}

const UI_VAKIT_LISTESI = [
  { key: 'sabah', label: 'SABAH' },
  { key: 'gunes', label: 'GÜNEŞ' },
  { key: 'ogle', label: 'ÖĞLE' },
  { key: 'ikindi', label: 'İKİNDİ' },
  { key: 'aksam', label: 'AKŞAM' },
  { key: 'yatsi', label: 'YATSI' }
] as const;

export const AnaEkranHero = React.memo(({
  isLoading,
  mevcutVakit,
  sonraki,
  bugunDate,
  bugunVakitler,
}: AnaEkranHeroProps) => {
  const currentStatus = useMemo(() => {
    if (!bugunVakitler || !mevcutVakit) return null;
    
    const dateStr = format(bugunDate, 'yyyy-MM-dd');
    const baslangicZamani = parseVakitToDate(dateStr, bugunVakitler[mevcutVakit]);
    
    if (!baslangicZamani) return null;

    return {
      mevcutVakit,
      baslangicZamani,
      imsakSaati: parseVakitToDate(dateStr, bugunVakitler.sabah) || undefined,
      gunesSaati: parseVakitToDate(dateStr, bugunVakitler.gunes) || undefined,
      ogleSaati: parseVakitToDate(dateStr, bugunVakitler.ogle) || undefined,
      aksamSaati: parseVakitToDate(dateStr, bugunVakitler.aksam) || undefined
    };
  }, [bugunVakitler, mevcutVakit, bugunDate]);

  const isFriday = bugunDate.getDay() === 5;
  const hijriDate = useMemo(() => getHijriDate(bugunDate), [bugunDate]);

  const auraColor = useMemo(() => {
    switch (mevcutVakit) {
      case 'aksam': return 'var(--aura-rose)';
      case 'yatsi': return 'var(--aura-indigo)';
      case 'ogle': 
      case 'ikindi': return 'var(--aura-amber)';
      case 'sabah': return 'var(--aura-emerald)';
      default: return 'var(--aura-indigo)';
    }
  }, [mevcutVakit]);

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[calc(100dvh-144px-env(safe-area-inset-bottom,0px))] md:min-h-[740px] h-auto mt-2">
      <AnimatePresence>
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex-1 min-h-[400px] flex items-center justify-center bg-[var(--surface-medium)] rounded-[34px] border border-[var(--glass-border)]"
          >
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex-1 flex flex-col justify-between p-4 sm:p-8 bg-[var(--spatial-glass-bg)] backdrop-blur-xl rounded-[34px] border border-[var(--glass-border)] relative overflow-hidden shadow-[var(--spatial-shadow)]"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent pointer-events-none z-0 rounded-[34px]" />
            
            {/* Dynamic Glass Prisms (Diffused Atmospheric Color Glows) */}
            <div 
              className="absolute -top-36 -left-36 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-1000 opacity-20 dark:opacity-8"
              style={{ 
                background: auraColor
              }}
            />
            <div 
              className="absolute -bottom-36 -right-36 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-1000 opacity-15 dark:opacity-4"
              style={{ 
                background: auraColor
              }}
            />
            
            {/* Header */}
            <div className="w-full flex justify-between items-start z-10 relative">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="p-2 sm:p-3 bg-[var(--surface-medium)] rounded-2xl border border-[var(--glass-border)]">
                  <Logo size={32} className="text-[var(--text-primary)]" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-[var(--text-secondary)]/50 tracking-widest font-bold uppercase">Dijital Makâm</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-light text-[var(--text-primary)] tracking-tight">
                    {format(bugunDate, 'd MMMM yyyy', { locale: tr })}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[13px] font-medium tracking-wider text-indigo-400">
                      {hijriDate}
                    </span>
                    {isFriday && (
                      <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                        Hayırlı Cumalar
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="px-4 py-2 bg-[var(--surface-medium)] backdrop-blur-md rounded-2xl border border-[var(--glass-border)] inline-block">
                   <LiveClock />
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-3 tracking-widest uppercase font-medium">
                  {format(bugunDate, 'EEEE', { locale: tr })}
                </p>
              </div>
            </div>

            {/* Countdown / Chronograph */}
            <div className="flex-1 flex items-center justify-center z-10 relative py-4 sm:py-8">
              {sonraki && currentStatus && (
                <GeriSayim 
                  ezanSaati={sonraki.ezanSaati} 
                  baslangicZamani={currentStatus.baslangicZamani}
                  mevcutVakit={currentStatus.mevcutVakit}
                  sonrakiVakit={sonraki.vakit}
                  imsakSaati={currentStatus.imsakSaati}
                  gunesSaati={currentStatus.gunesSaati}
                  ogleSaati={currentStatus.ogleSaati}
                  aksamSaati={currentStatus.aksamSaati}
                />
              )}
            </div>

            {/* Vakit Matrix — 6-Column Responsive Grid */}
            <div className="w-full z-10 relative mt-4">
              {bugunVakitler && (
                <div className="grid grid-cols-6 gap-1 sm:gap-2">
                  {UI_VAKIT_LISTESI.map(({ key, label }, idx) => {
                    const isActive = mevcutVakit === key;
                    const isNext = sonraki?.vakit === key;
                    const timeStr = bugunVakitler[key as keyof GunlukVakit] as string;
                    
                    // Determine if this vakit is in the past
                    const mevcutIndex = UI_VAKIT_LISTESI.findIndex(v => v.key === mevcutVakit);
                    const isPast = mevcutIndex !== -1 && idx < mevcutIndex;

                    // Compute dynamic premium styles based on state
                    let cardStyle = '';
                    let indicatorDot = null;
                    let labelColor = '';
                    let timeColor = '';

                    if (isActive) {
                      labelColor = 'text-white font-bold opacity-90';
                      timeColor = 'text-white font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]';
                      
                      switch (key as string) {
                        case 'sabah':
                          cardStyle = 'bg-gradient-to-b from-indigo-600 to-indigo-700 dark:from-indigo-500/25 dark:via-violet-500/15 dark:to-rose-500/5 border-indigo-500/20 dark:border-indigo-400/65 shadow-[0_12px_24px_-8px_rgba(99,102,241,0.45)] dark:shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.04] z-20';
                          indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.9)] animate-pulse" />;
                          break;
                        case 'gunes':
                          cardStyle = 'bg-gradient-to-b from-amber-500 to-orange-600 dark:from-amber-500/25 dark:via-orange-500/15 dark:to-yellow-500/5 border-amber-500/20 dark:border-amber-400/65 shadow-[0_12px_24px_-8px_rgba(245,158,11,0.45)] dark:shadow-[0_0_30px_rgba(245,158,11,0.15)] scale-[1.04] z-20';
                          indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-200 dark:bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)] animate-pulse" />;
                          break;
                        case 'ogle':
                          cardStyle = 'bg-gradient-to-b from-emerald-500 to-teal-600 dark:from-emerald-500/25 dark:via-teal-500/15 dark:to-emerald-600/5 border-emerald-500/20 dark:border-emerald-400/65 shadow-[0_12px_24px_-8px_rgba(16,185,129,0.45)] dark:shadow-[0_0_30px_rgba(16,185,129,0.15)] scale-[1.04] z-20';
                          indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-200 dark:bg-emerald-400 shadow-[0_0_10px_rgba(10,185,129,0.9)] animate-pulse" />;
                          break;
                        case 'ikindi':
                          cardStyle = 'bg-gradient-to-b from-orange-500 to-amber-600 dark:from-orange-500/25 dark:via-amber-600/15 dark:to-amber-500/5 border-orange-500/20 dark:border-orange-400/65 shadow-[0_12px_24px_-8px_rgba(249,115,22,0.45)] dark:shadow-[0_0_30px_rgba(249,115,22,0.15)] scale-[1.04] z-20';
                          indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-orange-300 dark:bg-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.9)] animate-pulse" />;
                          break;
                        case 'aksam':
                          cardStyle = 'bg-gradient-to-b from-rose-500 to-purple-600 dark:from-rose-500/25 dark:via-purple-500/15 dark:to-indigo-500/5 border-rose-500/20 dark:border-rose-400/65 shadow-[0_12px_24px_-8px_rgba(244,63,94,0.45)] dark:shadow-[0_0_30px_rgba(244,63,94,0.15)] scale-[1.04] z-20';
                          indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-200 dark:bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse" />;
                          break;
                        case 'yatsi':
                          cardStyle = 'bg-gradient-to-b from-indigo-600 to-blue-900 dark:from-indigo-500/30 dark:via-blue-900/15 dark:to-slate-900/5 border-indigo-500/20 dark:border-indigo-400/70 shadow-[0_12px_24px_-8px_rgba(99,102,241,0.5)] dark:shadow-[0_0_35px_rgba(99,102,241,0.2)] scale-[1.04] z-20';
                          indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.9)] animate-pulse" />;
                          break;
                        default:
                          cardStyle = 'bg-indigo-600 dark:bg-indigo-500/10 border-indigo-500/30 scale-[1.04] z-20';
                          indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-indigo-400 animate-pulse" />;
                      }
                    } else if (isNext) {
                      cardStyle = 'bg-indigo-500/5 dark:bg-indigo-500/5 border-indigo-500/30 dark:border-indigo-500/25 border-dashed shadow-[0_0_15px_rgba(99,102,241,0.06)] hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:scale-[1.01]';
                      indicatorDot = <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400/45 shadow-[0_0_8px_rgba(99,102,241,0.4)] animate-pulse" />;
                      labelColor = 'text-indigo-600 dark:text-indigo-400/90 font-bold';
                      timeColor = 'text-[var(--text-primary)] font-medium';
                    } else if (isPast) {
                      cardStyle = 'bg-white/[0.008] dark:bg-black/[0.12] border-white/[0.02] opacity-35 hover:opacity-50 scale-[0.98]';
                      labelColor = 'text-[var(--text-secondary)]/35 font-medium';
                      timeColor = 'text-[var(--text-secondary)]/25 font-light';
                    } else {
                      cardStyle = 'bg-[var(--surface-low)] border-[var(--glass-border)] hover:bg-white/[0.015] hover:border-white/[0.06] hover:scale-[1.01]';
                      labelColor = 'text-[var(--text-secondary)]/40 font-medium';
                      timeColor = 'text-[var(--text-secondary)]/60 font-medium';
                    }

                    return (
                      <motion.div
                        key={key}
                        whileHover={!isPast ? { y: -2 } : {}}
                        whileTap={!isPast ? { scale: 0.98 } : {}}
                        className={`relative flex flex-col items-center justify-center py-4 sm:py-6 px-0.5 sm:px-2 rounded-xl sm:rounded-3xl border transition-all duration-500 cursor-pointer ${cardStyle}`}
                      >
                        {indicatorDot}

                        <span className={`text-[7.5px] sm:text-[9.5px] tracking-[0.06em] sm:tracking-[0.15em] font-bold mb-1.5 transition-colors duration-500 uppercase ${labelColor}`}>
                          {label}
                          {isPast && <span className="ml-0.5 text-emerald-500/60 font-bold">✓</span>}
                        </span>
                        
                        <span className={`text-xs sm:text-[15px] tabular-nums tracking-tight transition-colors duration-500 ${timeColor}`}>
                          {timeStr}
                        </span>
                        
                        <div className="w-full max-w-[20px] sm:max-w-[30px] mt-2.5 h-[1.5px] rounded-full relative bg-white/5 overflow-hidden">
                          {isNext && (
                            <motion.div layoutId="active-vakit-line" className="absolute inset-0 bg-indigo-500 rounded-full" />
                          )}
                          {isActive && !isNext && (
                            <div className="absolute inset-0 bg-emerald-500/50 rounded-full" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
