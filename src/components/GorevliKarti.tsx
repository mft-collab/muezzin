import React from 'react';
import { motion } from 'motion/react';
import { Shield, Sparkles, CheckCircle2, Hourglass, Compass } from 'lucide-react';

interface GorevliKartiProps {
  tip: 'asil' | 'yedek';
  isim?: string;
  durum?: 'bekliyor' | 'onaylandi' | 'reddedildi';
  isUser?: boolean;
  izinde?: boolean;
  isFriday: boolean;
}

const PersonaAvatar = React.memo(({ name, colorClass, isUser }: { name: string; colorClass: string; isUser: boolean }) => {
  const initials = name === 'Sistem' ? 'SA' : (name || '').split(' ').filter(Boolean).map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-[22px] sm:rounded-[28px] flex items-center justify-center relative overflow-hidden border shadow-lg transition-all duration-500 ${colorClass} ${isUser ? 'animate-heartbeat' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-30" />
      <span className={`text-lg sm:text-xl font-semibold tracking-tight relative z-10 ${isUser ? 'text-white' : 'text-[var(--text-primary)]/70'}`}>
        {initials}
      </span>
      {isUser && (
        <div className="absolute bottom-1 right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--app-bg)] z-20 shadow-[0_0_8px_rgba(16,185,129,0.7)]">
           <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping-slow" />
        </div>
      )}
    </div>
  );
});

export const GorevliKarti = React.memo(({ tip, isim, durum, isUser, izinde, isFriday }: GorevliKartiProps) => {
  const isAsil = tip === 'asil';
  
  const hoverTextClass = isFriday 
    ? 'group-hover:text-emerald-400' 
    : isAsil ? 'group-hover:text-indigo-400' : 'group-hover:text-amber-400';

  const kartClass = isUser
    ? isFriday
      ? 'spatial-glass-elevated !bg-emerald-500/[0.015] border-emerald-500/25 shadow-emerald-500/5'
      : isAsil
        ? 'spatial-glass-elevated !bg-indigo-500/[0.015] border-indigo-500/25 shadow-indigo-500/5'
        : 'spatial-glass-elevated !bg-amber-500/[0.015] border-amber-500/25 shadow-amber-500/5'
    : 'spatial-glass hover:bg-white/[0.015]';

  // Dynamic spatial theme under-glow on hover
  const hoverGlowClass = isFriday
    ? 'hover:border-emerald-500/35 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.1)]'
    : isAsil
      ? 'hover:border-indigo-500/35 hover:shadow-[0_20px_40px_-15px_rgba(99,102,241,0.1)]'
      : 'hover:border-amber-500/35 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.1)]';

  const gradientColor = isFriday 
    ? 'rgba(16,185,129,1)' 
    : isAsil ? 'rgba(99,102,241,1)' : 'rgba(245,158,11,1)';

  const titleText = isAsil
    ? (isFriday ? 'CUMA ASİLİ' : 'ASİL GÖREVLİ')
    : (isFriday ? 'CUMA YEDEĞİ' : 'YEDEK GÖREVLİ');

  const titleColorClass = isUser
    ? isFriday ? 'text-emerald-400 opacity-100 font-semibold' : isAsil ? 'text-indigo-400 opacity-100 font-semibold' : 'text-amber-400 opacity-100 font-semibold'
    : 'opacity-35';

  const dotColorClass = isUser
    ? isFriday ? 'bg-emerald-400 shadow-[0_0_10px_rgb(52,211,153)]' : isAsil ? 'bg-indigo-400' : 'bg-amber-400'
    : 'bg-white/20';

  const avatarColorClass = isUser
    ? isFriday
      ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-lg border-emerald-400/30'
      : isAsil 
        ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 text-white shadow-lg border-indigo-400/30' 
        : 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600 text-white shadow-lg border-amber-400/30'
    : 'bg-white/[0.03] text-white/40 border-white/[0.06]';

  const badgeText = isAsil ? 'ASİL KADRO' : 'DESTEK KUVVET';
  const badgeClass = isAsil 
    ? (isFriday ? 'badge-glow-emerald' : 'badge-glow-indigo')
    : 'badge-glow-amber';

  return (
    <div className={`relative p-6 sm:p-8 transition-all duration-500 overflow-hidden group !rounded-[38px] border border-white/5 hover:-translate-y-1 hover:scale-[1.008] active:scale-[0.985] ${kartClass} ${hoverGlowClass} shimmer-trigger`}>
      <div className="kinetic-sheen" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
      <div
        className={`absolute top-0 right-0 w-48 h-48 rounded-full -translate-y-1/2 translate-x-1/2 transition-opacity duration-700 pointer-events-none ${isFriday ? 'opacity-10' : 'opacity-5 group-hover:opacity-8'}`}
        style={{ background: `radial-gradient(circle, ${gradientColor} 0%, transparent 70%)` }}
      />

      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <PersonaAvatar name={isim || ''} isUser={!!isUser} colorClass={avatarColorClass} />
            <div>
              <div className="flex items-center gap-2 mb-2 sm:mb-2.5">
                <div className={`w-1.5 h-1.5 rounded-full ${dotColorClass}`} />
                <span className={`authority-title !text-[7.5px] tracking-[0.2em] font-semibold ${titleColorClass}`}>
                  {titleText}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h3 className={`text-2xl sm:text-3xl font-light tracking-tight leading-none text-white ${hoverTextClass} transition-all duration-500 group-hover:font-normal group-active:font-semibold`}>
                  {isim === 'Sistem' ? 'Otonom Atama' : isim && isim !== 'Bilinmiyor' ? isim : 'BOŞ KADRO'}
                </h3>
                {isim && isim !== 'Bilinmiyor' && isim !== 'Sistem' && (
                  <div className={`mt-0.5 inline-flex items-center gap-1.5 ${badgeClass}`}>
                    {isAsil ? <Sparkles size={9} className="opacity-80" /> : <Shield size={9} className="opacity-80" />}
                    <span>{badgeText}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-[7rem] justify-end shrink-0">
            {durum === 'onaylandi' && (
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-[14px] border transition-all duration-500 ${isFriday ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                <CheckCircle2 size={11} className="text-emerald-400 shadow-sm" />
                <span className="text-[7.5px] font-bold uppercase tracking-[0.15em] text-emerald-400">AKTİF</span>
              </div>
            )}
            {durum === 'bekliyor' && (
              <motion.div
                onClick={() => document.getElementById('gorev-akisi')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 px-4 py-1.5 rounded-[14px] bg-amber-500/10 border border-amber-500/20 shadow-sm cursor-pointer hover:bg-amber-500/15 transition-all"
              >
                <Hourglass size={11} className="text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span className="text-[7.5px] font-bold uppercase tracking-[0.15em] text-amber-400">BEKLEYİŞTE</span>
              </motion.div>
            )}
            {izinde && (
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-[14px] bg-rose-500/10 border border-rose-500/20 shadow-sm">
                <Compass size={11} className="text-rose-400" />
                <span className="text-[7.5px] font-bold uppercase tracking-[0.15em] text-rose-400">MEŞRU MAZERET</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
