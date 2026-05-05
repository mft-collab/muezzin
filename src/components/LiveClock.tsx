import React, { useState, useEffect } from 'react';
import { getTurkeyTimeFormatted } from '../lib/dateUtils';

export function LiveClock() {
  const [time, setTime] = useState(getTurkeyTimeFormatted());

  useEffect(() => {
    const timer = setInterval(() => setTime(getTurkeyTimeFormatted()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex justify-end items-center gap-1.5 opacity-80">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        <span className="text-white font-medium text-[10px] uppercase tracking-widest">SAAT</span>
      </div>
      <span className="text-white/70 text-[9px] uppercase tracking-[0.1em] font-mono tabular-nums">
        {time}
      </span>
    </div>
  );
}
