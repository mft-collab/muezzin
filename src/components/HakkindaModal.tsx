import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Code, Cpu, Globe, CheckCircle2 } from 'lucide-react';
import { Logo } from './ui/Logo';
import { playClick, playSuccess } from '../lib/sounds';

interface HakkindaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HakkindaModal: React.FC<HakkindaModalProps> = ({ isOpen, onClose }) => {
  const handleClose = () => {
    playClick();
    onClose();
  };

  const handleLinkClick = () => {
    playSuccess();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 sm:px-0">
          {/* Deep Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(40px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-black/40"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 1 }}
            className="relative w-full max-w-[420px] spatial-glass border border-[var(--text-primary)]/10 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col items-center p-8 sm:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              aria-label="Kapat"
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--text-primary)]/5 hover:bg-[var(--text-primary)]/10 border border-[var(--text-primary)]/5 transition-colors"
            >
              <X size={16} className="text-[var(--text-primary)]/60 hover:text-[var(--text-primary)]" />
            </button>

            {/* Glowing Aura Background */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[var(--aura-indigo)]/30 blur-[80px] rounded-full pointer-events-none animate-pulse" />

            {/* Logo */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
              className="relative z-10 mb-6"
            >
              <Logo size={72} variant="dynamic" className="text-[var(--text-primary)] drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]" glowColor="rgba(255,255,255,0.6)" />
            </motion.div>

            {/* App Name & Version */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
              className="flex flex-col items-center mb-6 relative z-10"
            >
              <h2 className="text-3xl font-light tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-2">
                Müezzin Pro
              </h2>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10">
                <Sparkles size={10} className="text-[var(--aura-indigo)]" />
                <span className="text-[11px] font-bold tracking-widest text-[var(--text-primary)]/80 uppercase">
                  Sürüm 2.2.0 (Build 860)
                </span>
              </div>
            </motion.div>

            {/* Mission Statement */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="text-center mb-10 relative z-10"
            >
              <p className="text-sm font-light text-[var(--text-primary)]/60 leading-relaxed max-w-[280px]">
                "Vakitlerin emanetçileri için kusursuz hassasiyetle tasarlandı."
              </p>
            </motion.div>

            {/* Technologies Grid */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
              className="grid grid-cols-2 gap-3 w-full mb-8 relative z-10"
            >
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/5">
                <div className="w-6 h-6 rounded-lg bg-[var(--aura-indigo)]/10 flex items-center justify-center">
                  <Cpu size={12} className="text-[var(--aura-indigo)]" />
                </div>
                <span className="text-[11px] font-bold tracking-wide text-[var(--text-primary)]/70 uppercase">Planlama Motoru</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/5">
                <div className="w-6 h-6 rounded-lg bg-[var(--status-success)]/10 flex items-center justify-center">
                  <Globe size={12} className="text-[var(--status-success)]" />
                </div>
                <span className="text-[11px] font-bold tracking-wide text-[var(--text-primary)]/70 uppercase">Offline İlk</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/5">
                <div className="w-6 h-6 rounded-lg bg-[var(--aura-amber)]/10 flex items-center justify-center">
                  <Code size={12} className="text-[var(--aura-amber)]" />
                </div>
                <span className="text-[11px] font-bold tracking-wide text-[var(--text-primary)]/70 uppercase">React Mimarisi</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/5">
                <div className="w-6 h-6 rounded-lg bg-[var(--aura-rose)]/10 flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-[var(--aura-rose)]" />
                </div>
                <span className="text-[11px] font-bold tracking-wide text-[var(--text-primary)]/70 uppercase">Apple HIG</span>
              </div>
            </motion.div>

            {/* Footer / Credits */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="w-full pt-6 border-t border-[var(--text-primary)]/10 flex flex-col items-center justify-center gap-1 relative z-10"
            >
              <span className="text-[11px] font-extrabold tracking-[0.2em] text-[var(--text-secondary)] uppercase">
                Tasarım ve Geliştirme
              </span>
              <button 
                onClick={handleLinkClick}
                className="text-[11px] font-bold tracking-wide text-[var(--text-primary)]/80 hover:text-[var(--text-primary)] transition-colors"
              >
                Google DeepMind Advanced Agentic Coding
              </button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
