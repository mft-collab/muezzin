import { useState, useEffect } from 'react';
import { getTurkeyNow, VAKIT_GORA_ISIMLERI, toTurkishUpperCase } from '../lib/dateUtils';
import { motion } from 'motion/react';
import { Vakit } from '../types';
import { getDynamicTheme } from '../lib/themeUtils';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const DEFAULT_BASLANGIC_MS = MS_PER_HOUR;

const TimeUnit = ({ value, label }: { value: number; label: string }) => (
  <motion.div key={`${label}-${value}`} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="flex flex-col items-center">
    <span className="text-[52px] xs:text-[64px] font-sans font-thin text-white leading-none tracking-tight tabular-nums drop-shadow-xl" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
      {String(value).padStart(2, '0')}
    </span>
    <span className="text-[9px] font-medium text-white/50 uppercase mt-4 tracking-widest">{label}</span>
  </motion.div>
);

export function GeriSayim({ 
  ezanSaati, 
  baslangicZamani, 
  sonrakiVakit 
}: { 
  ezanSaati: Date, 
  baslangicZamani?: Date,
  sonrakiVakit?: Vakit 
}) {
  const [farkMs, setFarkMs] = useState(() => Math.max(0, ezanSaati.getTime() - getTurkeyNow().getTime()));

  useEffect(() => {
    const timer = setInterval(() => {
      const newFark = ezanSaati.getTime() - getTurkeyNow().getTime();
      setFarkMs(Math.max(0, newFark));
    }, 1000);
    return () => clearInterval(timer);
  }, [ezanSaati]);

  const toplamSure = baslangicZamani ? (ezanSaati.getTime() - baslangicZamani.getTime()) : DEFAULT_BASLANGIC_MS;
  const progress = Math.max(0, Math.min(1, (toplamSure - farkMs) / toplamSure));
  
  const currentTheme = getDynamicTheme(sonrakiVakit);
  
  const h = Math.floor(farkMs / MS_PER_HOUR);
  const m = Math.floor((farkMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const s = Math.floor((farkMs % MS_PER_MINUTE) / MS_PER_SECOND);

  if (farkMs <= 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
        <span className="text-white font-medium text-xs uppercase tracking-widest">Vakit Geldi</span>
      </div>
    );
  }

  // Neon Glow ve Orb için hesaplamalar
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  
  const size = 200;
  const center = size / 2;

  // Orb pozisyonu (Saat yönünde dolum)
  const angle = progress * 360 - 90;
  const orbX = center + radius * Math.cos((angle * Math.PI) / 180);
  const orbY = center + radius * Math.sin((angle * Math.PI) / 180);

  return (
    <div className="relative w-64 h-64 flex items-center justify-center group">
      {/* Background Glow */}
      <div 
        className="absolute inset-4 rounded-full blur-2xl group-hover:opacity-100 opacity-60 transition-all duration-1000" 
        style={{ backgroundColor: currentTheme.bgGlow }}
      />
      
      {/* SVG Path */}
      <svg className="absolute inset-0 w-full h-full -rotate-90 overflow-visible" viewBox={`0 0 ${size} ${size}`}>
        {/* Track Circle (Bitiş hedefini gösterir) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="10"
        />
        
        {/* Glow Stroke */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={currentTheme.color}
          strokeWidth="12"
          strokeLinecap="round"
          className="opacity-20 blur-[10px]"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress }}
          transition={{ duration: 1.5, ease: "circOut" }}
        />

        {/* Main Progress Stroke */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={currentTheme.color}
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress }}
          transition={{ duration: 1.5, ease: "circOut" }}
        />

        {/* Tip Orb (Işık Küresi) */}
        <motion.circle
          cx={orbX}
          cy={orbY}
          r="10"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{ 
            fill: currentTheme.color,
            filter: `drop-shadow(0 0 15px ${currentTheme.glow})` 
          }}
        />
      </svg>
      
      <div className="relative flex flex-col items-center z-10 mt-2">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 h-16 mb-4">
            <TimeUnit value={h} label="Saat" />
            <span className="text-[40px] font-thin text-white/20 mb-8">:</span>
            <TimeUnit value={m} label="Dak" />
            <span className="text-[40px] font-thin text-white/20 mb-8">:</span>
            <TimeUnit value={s} label="Sn" />
          </div>
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-3" />
          <span className="text-[8px] font-medium text-white/50 tracking-widest uppercase text-center">
            {sonrakiVakit ? `${toTurkishUpperCase(VAKIT_GORA_ISIMLERI[sonrakiVakit])} VAKTİNE KALAN` : 'KALAN SÜRE'}
          </span>
        </div>
      </div>
      <div className="absolute inset-0 border border-white/[0.03] rounded-full" />
    </div>
  );
}
