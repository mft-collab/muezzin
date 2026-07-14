/**
 * OzelVakitBanner.tsx — Özel Dini Vakit Bildirimi Banner Bileşeni
 *
 * Vakit kartları altında görünen, animasyonlu bilgi banneri.
 * Kerahat, Teheccüd, Bayram ve Teşrik mesajlarını gösterir.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Sun, Star, Bell, Clock } from 'lucide-react';
import { OzelVakitDurumu, OzelVakitTip, TesrikVakitRenk } from '../hooks/useOzelVakitMesaji';
import { useTime } from '../hooks/useTime';

interface OzelVakitBannerProps {
  durum: OzelVakitDurumu;
}

// ────────────────────────────────────────�
function getKerahatStyle() {
  return {
    bg:      'bg-amber-500/[0.04] dark:bg-amber-500/[0.02]',
    border:  'border-amber-500/20 dark:border-amber-400/15',
    glow:    'from-amber-500/10 to-transparent',
    dot:     'bg-amber-500',
    icon:    'text-amber-600 dark:text-amber-400',
    title:   'text-[var(--text-primary)] font-black',
    sub:     'text-amber-600 dark:text-amber-400/80',
    body:    'text-[var(--text-secondary)]',
    bar:     'bg-amber-500',
    shadow:  'shadow-amber-500/5',
  };
}

function getTeheccudStyle() {
  return {
    bg:      'bg-violet-500/[0.04] dark:bg-violet-500/[0.02]',
    border:  'border-violet-500/20 dark:border-violet-400/15',
    glow:    'from-violet-500/10 to-transparent',
    dot:     'bg-violet-500',
    icon:    'text-violet-600 dark:text-violet-400',
    title:   'text-[var(--text-primary)] font-black',
    sub:     'text-violet-600 dark:text-violet-400/80',
    body:    'text-[var(--text-secondary)]',
    bar:     'bg-violet-500',
    shadow:  'shadow-violet-500/5',
  };
}

function getBayramStyle(tip: OzelVakitTip) {
  if (tip === 'bayram_arife') {
    return {
      bg:     'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02]',
      border: 'border-emerald-500/20 dark:border-emerald-400/15',
      glow:   'from-emerald-500/10 to-transparent',
      dot:    'bg-emerald-500',
      icon:   'text-emerald-600 dark:text-emerald-400',
      title:  'text-[var(--text-primary)] font-black',
      sub:    'text-emerald-600 dark:text-emerald-400/80',
      body:   'text-[var(--text-secondary)]',
      bar:    'bg-emerald-500',
      shadow: 'shadow-emerald-500/5',
    };
  }
  return {
    bg:     'bg-rose-500/[0.04] dark:bg-rose-500/[0.02]',
    border: 'border-rose-500/20 dark:border-rose-400/15',
    glow:   'from-rose-500/10 to-transparent',
    dot:    'bg-rose-500',
    icon:   'text-rose-600 dark:text-rose-400',
    title:  'text-[var(--text-primary)] font-black',
    sub:    'text-rose-600 dark:text-rose-400/80',
    body:   'text-[var(--text-secondary)]',
    bar:    'bg-rose-500',
    shadow: 'shadow-rose-500/5',
  };
}

function getCumaStyle() {
  return {
    bg:      'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02]',
    border:  'border-emerald-500/20 dark:border-emerald-400/15',
    glow:    'from-emerald-500/10 to-transparent',
    dot:     'bg-emerald-500',
    icon:    'text-emerald-600 dark:text-emerald-400',
    title:   'text-[var(--text-primary)] font-black',
    sub:     'text-emerald-600 dark:text-emerald-400/80',
    body:    'text-[var(--text-secondary)]',
    bar:     'bg-emerald-500',
    shadow:  'shadow-emerald-500/5',
  };
}

const TESRIK_RENK_MAP: Record<TesrikVakitRenk, ReturnType<typeof getTeheccudStyle>> = {
  emerald: {
    bg: 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02]', border: 'border-emerald-500/20 dark:border-emerald-400/15',
    glow: 'from-emerald-500/10 to-transparent', dot: 'bg-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-[var(--text-primary)] font-black', sub: 'text-emerald-600 dark:text-emerald-400/80',
    body: 'text-[var(--text-secondary)]', bar: 'bg-emerald-500', shadow: 'shadow-emerald-500/5',
  },
  amber: {
    bg: 'bg-amber-500/[0.04] dark:bg-amber-500/[0.02]', border: 'border-amber-500/20 dark:border-amber-400/15',
    glow: 'from-amber-500/10 to-transparent', dot: 'bg-amber-500', icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-[var(--text-primary)] font-black', sub: 'text-amber-600 dark:text-amber-400/80',
    body: 'text-[var(--text-secondary)]', bar: 'bg-amber-500', shadow: 'shadow-amber-500/5',
  },
  orange: {
    bg: 'bg-orange-500/[0.04] dark:bg-orange-500/[0.02]', border: 'border-orange-500/20 dark:border-orange-400/15',
    glow: 'from-orange-500/10 to-transparent', dot: 'bg-orange-500', icon: 'text-orange-600 dark:text-orange-400',
    title: 'text-[var(--text-primary)] font-black', sub: 'text-orange-600 dark:text-orange-400/80',
    body: 'text-[var(--text-secondary)]', bar: 'bg-orange-500', shadow: 'shadow-orange-500/5',
  },
  rose: {
    bg: 'bg-rose-500/[0.04] dark:bg-rose-500/[0.02]', border: 'border-rose-500/20 dark:border-rose-400/15',
    glow: 'from-rose-500/10 to-transparent', dot: 'bg-rose-500', icon: 'text-rose-600 dark:text-rose-400',
    title: 'text-[var(--text-primary)] font-black', sub: 'text-rose-600 dark:text-rose-400/80',
    body: 'text-[var(--text-secondary)]', bar: 'bg-rose-500', shadow: 'shadow-rose-500/5',
  },
  violet: {
    bg: 'bg-violet-500/[0.04] dark:bg-violet-500/[0.02]', border: 'border-violet-500/20 dark:border-violet-400/15',
    glow: 'from-violet-500/10 to-transparent', dot: 'bg-violet-500', icon: 'text-violet-600 dark:text-violet-400',
    title: 'text-[var(--text-primary)] font-black', sub: 'text-violet-600 dark:text-violet-400/80',
    body: 'text-[var(--text-secondary)]', bar: 'bg-violet-500', shadow: 'shadow-violet-500/5',
  },
};

function getStyle(durum: OzelVakitDurumu) {
  const { tip, tesrikVakitRenk } = durum;
  if (!tip) return null;
  if (tip === 'kerahat_dogus' || tip === 'kerahat_zeval' || tip === 'kerahat_gurub') return getKerahatStyle();
  if (tip === 'teheccud') return getTeheccudStyle();
  if (tip === 'bayram_arife' || tip === 'bayram') return getBayramStyle(tip);
  if (tip === 'tesrik') return TESRIK_RENK_MAP[tesrikVakitRenk ?? 'violet'];
  if (tip === 'cuma') return getCumaStyle();
  return null;
}

function getIkon(tip: OzelVakitTip) {
  switch (tip) {
    case 'kerahat_dogus': return <Sun size={16} strokeWidth={1.5} />;
    case 'kerahat_zeval': return <Sun size={16} strokeWidth={1.5} />;
    case 'kerahat_gurub': return <Sun size={16} strokeWidth={1.5} />;
    case 'teheccud':      return <Moon size={16} strokeWidth={1.5} />;
    case 'bayram_arife':  return <Star size={16} strokeWidth={1.5} />;
    case 'bayram':        return <Bell size={16} strokeWidth={1.5} />;
    case 'tesrik':        return <Bell size={16} strokeWidth={1.5} />;
    case 'cuma':          return <Star size={16} strokeWidth={1.5} />;
    default:              return <Clock size={16} strokeWidth={1.5} />;
  }
}

// ─────────────────────────────────────────────
// Kalan süre göstergesi
// ─────────────────────────────────────────────

function KalanSure({ bitisZamani, barClass }: { bitisZamani: Date; barClass: string }) {
  const now = useTime();

  const { kalanMetin, progress } = useMemo(() => {
    const kalanMs = bitisZamani.getTime() - now.getTime();
    if (kalanMs <= 0) return { kalanMetin: '—', progress: 1 };
    const kalanDk = Math.floor(kalanMs / 60000);
    const kalanSn = Math.floor((kalanMs % 60000) / 1000);
    const metin = kalanDk > 0 ? `${kalanDk} dk ${kalanSn} sn` : `${kalanSn} sn`;
    // Progress: ne kadar az kaldıysa bar o kadar dolu gösterir
    // Referans: max 90 dakika üzerinden normalize et
    const maxMs = 90 * 60 * 1000;
    // Başlangıçta 0, biterken 1'e yaklaşır
    const prog = Math.max(0, Math.min(1, 1 - kalanMs / maxMs));
    return { kalanMetin: metin, progress: prog };
  }, [now, bitisZamani]);

  return (
    <div className="flex flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-current/[0.06]">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold uppercase tracking-widest opacity-35">Kalan Süre</span>
        <span className="text-[11px] font-mono font-bold opacity-60">{kalanMetin}</span>
      </div>
      <div className="w-full h-[2px] bg-current/[0.08] rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${barClass} rounded-full origin-left`}
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// Ana bileşen
// ─────────────────────────────────────────────

export const OzelVakitBanner = React.memo<OzelVakitBannerProps>(({ durum }) => {
  const style = getStyle(durum);

  return (
    <AnimatePresence mode="wait">
      {durum.tip && style && (
        <motion.div
          key={durum.tip}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`
            relative w-full mt-4 spatial-glass border overflow-hidden
            ${style.bg} ${style.border}
            shadow-[var(--spatial-shadow)]
          `}
        >
          {/* Ambient glow sweep */}
          <div
            className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${style.glow}`}
            aria-hidden
          />
          <div
            className={`absolute top-0 left-[-40%] w-[80%] h-[200%] opacity-[0.06] blur-3xl rounded-full bg-gradient-to-b ${style.glow} pointer-events-none`}
            aria-hidden
          />

          <div className="relative z-10 p-3.5 sm:p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {/* Pulsing dot */}
                <div className="relative flex-shrink-0">
                  <span className={`absolute inset-0 rounded-full ${style.dot} animate-ping opacity-35`} />
                  <span className={`relative block w-2 h-2 rounded-full ${style.dot}`} />
                </div>

                {/* Icon + Başlık */}
                <div className={`flex items-center gap-1.5 ${style.icon}`}>
                  {getIkon(durum.tip)}
                  <h3 className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${style.title}`}>
                    {durum.baslik}
                  </h3>
                </div>
              </div>

              {/* Alt başlık badge */}
              <span className={`text-[11px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border border-current/15 ${style.sub} flex-shrink-0 mt-0.5`}>
                {durum.altBaslik}
              </span>
            </div>

            {/* Açıklama */}
            <p className={`text-[11px] sm:text-[11px] leading-relaxed mt-2 font-medium ${style.body}`}>
              {durum.aciklama}
            </p>

            {/* Arapça metin (Teşrik için) */}
            {durum.arapca && (
              <div className="mt-3.5 p-3 rounded-2xl bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)]">
                <p
                  dir="rtl"
                  lang="ar"
                  className={`text-sm sm:text-base font-semibold leading-loose text-right text-[var(--text-primary)] opacity-95`}
                  style={{ fontFamily: "'Amiri', 'Traditional Arabic', serif" }}
                >
                  {durum.arapca}
                </p>
                {durum.transkript && (
                  <p className="text-[11px] sm:text-[11px] font-medium mt-1.5 text-[var(--text-secondary)] opacity-75">
                    {durum.transkript}
                  </p>
                )}
              </div>
            )}

            {/* Kalan süre göstergesi */}
            {durum.bitisZamani && (
              <KalanSure bitisZamani={durum.bitisZamani} barClass={style.bar} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
})

OzelVakitBanner.displayName = 'OzelVakitBanner';
