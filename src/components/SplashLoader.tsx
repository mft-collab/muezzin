/**
 * SplashLoader.tsx — SACRED PRECISION UPGRADE
 *
 * Değişiklikler:
 * - Logo animasyonu: scale 0.8 → 1, ease [0.16, 1, 0.3, 1], 1.2s
 * - "Müezzin" harfleri staggerChildren 0.05s ile tek tek belirir
 * - Loading bar yerine ince scaleX: 0 → 1 çizgi (opacity 0.18)
 * - Arka plan vakite göre yavaşça açılan radial gradient
 * - Logo etrafında çok yavaş dönen conic-gradient halo
 */

import React from 'react';
import { motion } from 'motion/react';
import { Logo } from './ui/Logo';

const MUEZZIN_CHARS = ['M', 'ü', 'e', 'z', 'z', 'i', 'n'];

export const SplashLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden">
      
      {/* Arka plan: yavaşça açılan radial aura */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1.4 }}
        transition={{ duration: 3.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div
          className="w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(165,180,252,0.04) 40%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </motion.div>

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative flex flex-col items-center gap-12">
        
        {/* Logo + halo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Dönen halo */}
          <motion.div
            className="absolute inset-[-12px] rounded-[52px] pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, rgba(165,180,252,0.35) 25%, transparent 50%, rgba(99,102,241,0.2) 75%, transparent 100%)',
              opacity: 0.2,
            }}
          />

          {/* Kart */}
          <div
            className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px)',
              borderRadius: '40px',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 40px 80px -20px rgba(0,0,0,0.8)',
            }}
          >
            {/* Specular highlight */}
            <div
              className="absolute top-0 left-0 right-0 pointer-events-none"
              style={{
                height: '1px',
                background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.25) 60%, transparent)',
              }}
            />
            <Logo size={80} variant="gold" />

            {/* Shine sweep */}
            <motion.div
              animate={{ x: ['-150%', '250%'] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3.5, ease: 'easeInOut' }}
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
              }}
            />
          </div>
        </motion.div>

        {/* Başlık — stagger harfler */}
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="flex items-baseline gap-0 overflow-hidden"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05, delayChildren: 0.5 } },
              hidden: {},
            }}
          >
            {MUEZZIN_CHARS.map((char, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 20, filter: 'blur(6px)' },
                  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontStyle: 'italic',
                  fontSize: 'clamp(36px, 8vw, 52px)',
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  color: 'rgba(255,255,255,0.92)',
                  lineHeight: 1,
                }}
              >
                {char}
              </motion.span>
            ))}
          </motion.div>

          {/* Alt etiket */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="flex items-center gap-3"
          >
            <div style={{ height: '1px', width: '20px', background: 'rgba(255,255,255,0.12)' }} />
            <span
              style={{
                fontSize: '8px',
                fontWeight: 300,
                letterSpacing: '0.55em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.25)',
              }}
            >
              HİZMET KOORDİNASYONU
            </span>
            <div style={{ height: '1px', width: '20px', background: 'rgba(255,255,255,0.12)' }} />
          </motion.div>
        </div>

        {/* Progress: ince scaleX çizgi */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="w-40 overflow-hidden"
          style={{ height: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px' }}
        >
          <motion.div
            initial={{ scaleX: 0, transformOrigin: 'left' }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.6, duration: 1.0, ease: [0.25, 1, 0.5, 1] }}
            style={{
              height: '100%',
              width: '100%',
              background: 'rgba(255,255,255,0.22)',
              transformOrigin: 'left',
            }}
          />
        </motion.div>
      </div>
    </div>
  );
};
