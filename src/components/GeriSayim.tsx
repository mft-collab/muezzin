import { useMemo } from 'react';
import { 
  getTurkeyNow, 
  VAKIT_GORA_ISIMLERI, 
  toTurkishUpperCase, 
  calculateLastThirdOfNight,
  calculateVakitProgress,
  calculateKerahatTimes
} from '../lib/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { Vakit } from '../types';
import { KerahatIcon } from './ui/KerahatIcon';
import { useTime } from '../hooks/useTime';

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR   = 60 * MS_PER_MINUTE;

const DigitPair = ({ value, dim }: { value: number; dim?: boolean }) => {
  const str = String(value).padStart(2, '0');
  return (
    <span className={`inline-flex tabular-nums ${dim ? 'opacity-45' : ''}`}>
      {str}
    </span>
  );
};

interface GeriSayimProps {
  ezanSaati: Date;
  baslangicZamani: Date;
  mevcutVakit: Vakit;
  sonrakiVakit: Vakit;
  imsakSaati?: Date; 
  gunesSaati?: Date; 
  ogleSaati?: Date;
  aksamSaati?: Date; 
}

export function GeriSayim({ 
  ezanSaati, 
  baslangicZamani, 
  mevcutVakit, 
  sonrakiVakit, 
  imsakSaati, 
  gunesSaati,
  ogleSaati,
  aksamSaati 
}: GeriSayimProps) {
  const now = useTime();

  const farkMs = Math.max(0, ezanSaati.getTime() - now.getTime());
  const h = Math.floor(farkMs / MS_PER_HOUR);
  const m = Math.floor((farkMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const s = Math.floor((farkMs % MS_PER_MINUTE) / MS_PER_SECOND);

  const teheccudBaslangic = useMemo(() => {
    if (aksamSaati && imsakSaati) return calculateLastThirdOfNight(aksamSaati, imsakSaati);
    return null;
  }, [aksamSaati, imsakSaati]);

  const isTeheccud = teheccudBaslangic && now >= teheccudBaslangic && now < imsakSaati!;
  const kerahatTimes = useMemo(() => {
    if (gunesSaati && ogleSaati && aksamSaati) {
      return calculateKerahatTimes(gunesSaati, ogleSaati, aksamSaati);
    }
    return null;
  }, [gunesSaati, ogleSaati, aksamSaati]);

  const isKerahat = useMemo(() => {
    if (!kerahatTimes) return false;
    const { sabah, ogle, aksam } = kerahatTimes;
    return (now >= sabah.baslangic && now < sabah.bitis) ||
           (now >= ogle.baslangic && now < ogle.bitis) ||
           (now >= aksam.baslangic && now < aksam.bitis);
  }, [kerahatTimes, now]);

  const progress = calculateVakitProgress(baslangicZamani, ezanSaati, now);
  const radius = 170;
  const circumference = 2 * Math.PI * radius;

  const isFriday = now.getDay() === 5;
  const isCumaVakti = isFriday && sonrakiVakit === 'ogle';

  // Theme Colors
  const auraColor = isKerahat 
    ? 'var(--aura-ruby)' 
    : (isCumaVakti 
        ? 'var(--aura-emerald)' 
        : (isTeheccud 
            ? 'var(--aura-indigo)' 
            : (mevcutVakit === 'aksam' ? 'var(--aura-ruby)' : 'var(--aura-amber)')));

  if (farkMs <= 0) {
    return (
      <div className="relative flex items-center justify-center w-[360px] h-[360px] sm:w-[400px] sm:h-[400px]">
        <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: `radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)` }} />
        <span className="authority-title text-emerald-400 text-xs tracking-[0.6em] font-semibold">EZAN OKUNUYOR</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center group w-full max-w-[420px] mx-auto">
      {/* HEADER: Contextual Intelligence */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-6 sm:mb-8 text-center relative z-20"
      >
        <div className="h-10 flex items-center justify-center mb-2 sm:mb-3">
          <AnimatePresence mode="wait">
            {isKerahat ? (
              <motion.div 
                key="kerahat"
                initial={{ scale: 0.9, opacity: 0, y: 5 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: -5 }}
                className="px-5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 shadow-lg shadow-rose-500/5"
              >
                <KerahatIcon size={14} className="text-rose-500 animate-pulse" />
                <span className="authority-title !text-[8px] text-rose-500 font-bold tracking-[0.25em]">KRİTİK: KERAHAT VAKTİ</span>
              </motion.div>
            ) : (
              <motion.div 
                key="periyot"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="flex items-center gap-3"
              >
                 <div className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse shadow-[0_0_12px_currentColor]`} style={{ color: auraColor }} />
                 <span className="authority-title text-[9px] sm:text-[10px] opacity-40 tracking-[0.4em] font-semibold uppercase">
                    {toTurkishUpperCase(VAKIT_GORA_ISIMLERI[mevcutVakit])} PERİYODU
                 </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <h2 
          className="font-extralight tracking-tighter text-4xl sm:text-6xl text-[var(--text-primary)] leading-none transition-all duration-700"
          style={{ textShadow: `0 0 40px ${auraColor}18` }}
        >
          {toTurkishUpperCase(VAKIT_GORA_ISIMLERI[mevcutVakit])}
        </h2>
      </motion.div>

      {/* CENTRAL RING: Spatial Depth */}
      <div className="relative flex items-center justify-center isolate" style={{ transform: 'translateZ(0)' }}>
        {/* Layered Background Glows */}
        <div className="absolute inset-0 rounded-full pointer-events-none scale-105" style={{ background: `radial-gradient(circle, var(--text-primary) 0%, transparent 70%)`, opacity: 0.02 }} />
        <div className="absolute inset-0 rounded-full scale-95 transition-all duration-1000 pointer-events-none" style={{ background: `radial-gradient(circle, ${auraColor} 0%, transparent 70%)`, opacity: 0.12 }} />

        <svg viewBox="0 0 440 440" className="w-full h-auto max-w-[260px] sm:max-w-[420px] relative z-10 overflow-visible">
          {/* Outer Track */}
          <circle
            cx="220"
            cy="220"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-[var(--text-primary)]"
            strokeOpacity="0.09"
            strokeWidth="1"
          />
          
          {/* Glow Progress Ring (Fake Glow to avoid WebKit GPU Culling) */}
          <circle
            cx="220"
            cy="220"
            r={radius}
            fill="none"
            stroke={auraColor}
            strokeOpacity="0.2"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            transform="rotate(-90 220 220)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />

          {/* Active Progress Ring */}
          <circle
            cx="220"
            cy="220"
            r={radius}
            fill="none"
            stroke={auraColor}
            strokeOpacity="0.95"
            strokeWidth="1.75"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            transform="rotate(-90 220 220)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />

          {/* Kinetic Orbit Dot Glow */}
          <circle
            cx="220"
            cy={220 - radius}
            r="7"
            fill="white"
            fillOpacity="0.25"
            transform={`rotate(${360 * progress} 220 220)`}
            style={{ transition: 'transform 1s linear' }}
          />
          {/* Kinetic Orbit Dot Core */}
          <circle
            cx="220"
            cy={220 - radius}
            r="3"
            fill="white"
            transform={`rotate(${360 * progress} 220 220)`}
            style={{ transition: 'transform 1s linear' }}
          />
        </svg>

        {/* CENTERPIECE: Digital Chronograph Glass Dial */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10">
          <div className="flex flex-col items-center gap-1 px-6 py-5 sm:px-8 sm:py-7">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* HOURS */}
              <div className="flex flex-col items-center">
                <div className="flex items-center text-[var(--text-primary)] font-light tracking-tighter" style={{ fontSize: 'clamp(34px, 8.5vw, 68px)', lineHeight: 1 }}>
                  <DigitPair value={h} />
                </div>
                <span className="authority-title !text-[6.5px] opacity-30 tracking-[0.25em] font-bold mt-1">SAAT</span>
              </div>

              <motion.span 
                animate={{ opacity: [0.15, 0.95, 0.15] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-xl sm:text-2xl -translate-y-2 font-light text-[var(--text-primary)]/20"
              >
                :
              </motion.span>

              {/* MINUTES */}
              <div className="flex flex-col items-center">
                <div className="flex items-center text-[var(--text-primary)] font-light tracking-tighter" style={{ fontSize: 'clamp(34px, 8.5vw, 68px)', lineHeight: 1 }}>
                  <DigitPair value={m} />
                </div>
                <span className="authority-title !text-[6.5px] opacity-30 tracking-[0.25em] font-bold mt-1">DAKİKA</span>
              </div>

              <motion.span 
                animate={{ opacity: [0.15, 0.95, 0.15] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="text-xl sm:text-2xl -translate-y-2 font-light text-[var(--text-primary)]/20"
              >
                :
              </motion.span>

              {/* SECONDS */}
              <div className="flex flex-col items-center">
                <div className="flex items-center text-[var(--text-primary)] font-light tracking-tighter" style={{ fontSize: 'clamp(34px, 8.5vw, 68px)', lineHeight: 1 }}>
                  <DigitPair value={s} dim />
                </div>
                <span className="authority-title !text-[6.5px] opacity-30 tracking-[0.25em] font-bold mt-1">SANİYE</span>
              </div>
            </div>

            {/* Target Label */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-4 sm:mt-5 flex flex-col items-center"
            >
              <div className={`px-4 py-1.5 rounded-full border transition-all duration-700 ${
                isCumaVakti 
                  ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.08)]'
                  : 'bg-white/[0.02] border-white/[0.04]'
              }`}>
                <span className={`authority-title !text-[7.5px] tracking-[0.3em] font-semibold ${isCumaVakti ? 'text-emerald-400 opacity-100' : 'opacity-40'}`}>
                   İSTİKAMET: {isCumaVakti ? 'CUMA NAMAZI' : toTurkishUpperCase(VAKIT_GORA_ISIMLERI[sonrakiVakit])}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

