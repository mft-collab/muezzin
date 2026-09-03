import React from 'react';
import { Modal } from './ui/Modal';
import { BellRing, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { hapticMedium, hapticLight } from '../lib/haptic';

interface NotificationPrimingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

// Tarayıcının native izin promptu öncesinde açıklayıcı bir ara adım —
// önceden `handleRequestNotificationPermission` doğrudan
// `Notification.requestPermission()` çağırıyordu; tarayıcı izni bir kez
// reddedilirse geri dönüşü zordur (bkz. premium denetim, bölüm 11), bu
// yüzden native promptu tetiklemeden önce kullanıcıya NEDEN gerektiğini
// gösteriyoruz (bkz. aynı desen: GpsConsentModal).
export function NotificationPrimingModal({ isOpen, onClose, onConfirm, isLoading }: NotificationPrimingModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Anlık Bildirimler"
    >
      <div className="flex flex-col items-center text-center py-4 relative">
        <div className="relative w-28 h-28 flex items-center justify-center mb-8 shrink-0">
          <div className="absolute inset-0 rounded-full bg-[var(--dynamic-aura,var(--aura-indigo))]/10 animate-ping opacity-40" />
          <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[var(--dynamic-aura,var(--aura-indigo))]/20 to-transparent border border-[var(--dynamic-aura,var(--aura-indigo))]/30 flex items-center justify-center relative shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
            <motion.div
              animate={isLoading ? { rotate: [0, -15, 15, 0] } : { scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            >
              <BellRing size={40} className="text-[var(--dynamic-aura,var(--aura-indigo))]" strokeWidth={1.5} />
            </motion.div>
          </div>
        </div>

        <p className="text-base sm:text-lg font-light text-[var(--text-secondary)] leading-relaxed max-w-md mb-8">
          Nöbet vaktiniz yaklaştığında, size bir görev devredildiğinde veya mazeret talebiniz sonuçlandığında haberdar olabilmeniz için bildirim izni vermeniz gerekmektedir.
        </p>

        <div className="w-full max-w-md p-4 rounded-2xl bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] mb-8 flex items-center gap-3 text-left">
          <Clock size={18} className="text-[var(--dynamic-aura,var(--aura-indigo))] shrink-0" strokeWidth={1.5} />
          <span className="text-2xs sm:text-2xs text-[var(--text-secondary)]/75 leading-tight">
            Hangi bildirimleri alacağınızı Ayarlar'dan istediğiniz zaman özelleştirebilirsiniz.
          </span>
        </div>

        <div className="w-full flex flex-col gap-3">
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { hapticMedium(); onConfirm(); }}
            disabled={isLoading}
            className="w-full py-5 rounded-[22px] border-none text-[var(--text-primary)] font-bold tracking-wider cursor-pointer shadow-lg shadow-[var(--dynamic-aura,var(--aura-indigo))]/20 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(to right, var(--dynamic-aura, var(--aura-indigo)), color-mix(in srgb, var(--dynamic-aura, var(--aura-indigo)) 70%, black))'
            }}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-[var(--text-primary)]/20 border-t-white animate-spin" />
                <span>İSTEK GÖNDERİLİYOR...</span>
              </>
            ) : (
              <span>İZİN VER</span>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { hapticLight(); onClose(); }}
            disabled={isLoading}
            className="w-full py-4 rounded-[22px] border border-[var(--glass-border)] bg-transparent hover:bg-[var(--text-primary)]/[0.02] text-[var(--text-secondary)] font-semibold cursor-pointer"
          >
            ŞİMDİ DEĞİL
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}
