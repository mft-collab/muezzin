import React from 'react';
import { Modal } from './ui/Modal';
import { Compass, Navigation } from 'lucide-react';
import { motion } from 'motion/react';
import { hapticMedium, hapticLight } from '../lib/haptic';

interface GpsConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export function GpsConsentModal({ isOpen, onClose, onConfirm, isLoading }: GpsConsentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Konum Hassasiyeti"
    >
      <div className="flex flex-col items-center text-center py-4 relative">
        {/* Animated Compass Icon */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-8 shrink-0">
          {/* Pulsing Aura */}
          <div className="absolute inset-0 rounded-full bg-[var(--dynamic-aura,var(--aura-indigo))]/10 animate-ping opacity-40" />
          <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[var(--dynamic-aura,var(--aura-indigo))]/20 to-transparent border border-[var(--dynamic-aura,var(--aura-indigo))]/30 flex items-center justify-center relative shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
            <motion.div
              animate={isLoading ? { rotate: 360 } : { rotate: [0, -10, 10, 0] }}
              transition={isLoading ? { repeat: Infinity, duration: 2, ease: "linear" } : { repeat: Infinity, duration: 6, ease: "easeInOut" }}
            >
              <Compass size={40} className="text-[var(--dynamic-aura,var(--aura-indigo))]" strokeWidth={1.5} />
            </motion.div>
          </div>
        </div>

        {/* Text */}
        <p className="text-base sm:text-lg font-light text-[var(--text-secondary)] leading-relaxed max-w-md mb-8">
          Ezan vakitlerini bulunduğunuz koordinata göre fıkhi standartlarda milimetrik doğrulukla hesaplayabilmemiz için konum erişimine izin vermeniz gerekmektedir.
        </p>

        {/* Privacy Note */}
        <div className="w-full max-w-md p-4 rounded-2xl bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] mb-8 flex items-center gap-3 text-left">
          <Navigation size={18} className="text-[var(--dynamic-aura,var(--aura-indigo))] shrink-0" strokeWidth={1.5} />
          <span className="text-[10px] sm:text-[11px] text-[var(--text-secondary)]/75 leading-tight">
            Konum verileriniz hiçbir sunucuya kaydedilmez, tamamen cihazınızda (lokal) işlenir.
          </span>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { hapticMedium(); onConfirm(); }}
            disabled={isLoading}
            className="w-full py-5 rounded-[22px] border-none bg-gradient-to-r from-[var(--dynamic-aura,var(--aura-indigo))] to-indigo-600 hover:to-indigo-500 text-white font-bold tracking-wider cursor-pointer shadow-lg shadow-[var(--dynamic-aura,var(--aura-indigo))]/20 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <span>SENKRONİZE EDİLİYOR...</span>
              </>
            ) : (
              <span>KONUMU EŞLEŞTİR</span>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { hapticLight(); onClose(); }}
            disabled={isLoading}
            className="w-full py-4 rounded-[22px] border border-[var(--glass-border)] bg-transparent hover:bg-[var(--text-primary)]/[0.02] text-[var(--text-secondary)] font-semibold cursor-pointer"
          >
            DAHA SONRA
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}
