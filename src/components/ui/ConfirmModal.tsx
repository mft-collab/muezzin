import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { toTurkishUpperCase } from '../../lib/dateUtils';

interface ConfirmModalProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 message: string;
 confirmText?: string;
 cancelText?: string;
 isDanger?: boolean;
}

export function ConfirmModal({ 
 isOpen, 
 onClose, 
 onConfirm, 
 title, 
 message, 
 confirmText = 'Onayla', 
 cancelText = 'Vazgeç',
 isDanger = false 
}: ConfirmModalProps) {
 return (
 <Modal isOpen={isOpen} onClose={onClose} title={title}>
 <div className="flex flex-col items-center text-center py-6">
    <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-10 border transition-all duration-700 ${
      isDanger
        ? 'bg-[var(--status-danger)]/10 border-[var(--status-danger)]/20 text-[var(--status-danger)] shadow-[0_0_25px_color-mix(in_srgb,var(--status-danger)_15%,transparent)] animate-float'
        : 'bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20 text-[var(--status-warning)] shadow-[0_0_25px_color-mix(in_srgb,var(--status-warning)_15%,transparent)]'
    }`}>
      <AlertTriangle size={32} strokeWidth={1.2} />
    </div>
    
    <p className="premium-label !text-2xs leading-relaxed max-w-sm mb-12 opacity-65 dark:opacity-40 tracking-wide px-4">
      {/* toTurkishUpperCase (bkz. src/lib/dateUtils.ts) — locale'siz
          `.toUpperCase()` Türkçe metinde "i" harfini yanlış büyütürdü ("İ"
          yerine "I"). Bu mesaj neredeyse her zaman Türkçe kelimeler VE bir
          kişinin adını (ör. "Ali", "Bilal") içerir — "aktif" → "AKTIF",
          "Ali" → "ALI" gibi hatalı sonuçlar üretiyordu (bkz. kod denetimi
          bulgusu; scripts/smoke-tests.ts'teki "türkçe büyük harf dönüşümü"
          testi zaten TAM OLARAK bu hatayı yakalayacak şekilde yazılmış ama
          bu bileşen o yardımcı fonksiyonu hiç kullanmıyordu). */}
      {toTurkishUpperCase(message)}
    </p>
    
    <div className="flex items-center gap-4 w-full px-4">
      <motion.button 
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onConfirm}
        className={`flex-1 py-4.5 rounded-[20px] text-2xs font-bold uppercase tracking-wide transition-all border-none cursor-pointer ${
          isDanger
            ? 'bg-[var(--status-danger)] text-[var(--app-bg)] shadow-[0_4px_15px_-3px_color-mix(in_srgb,var(--status-danger)_40%,transparent)] hover:shadow-[0_8px_25px_-5px_color-mix(in_srgb,var(--status-danger)_60%,transparent)]'
            : 'neural-btn'
        }`}
      >
        {toTurkishUpperCase(confirmText)}
      </motion.button>
      <motion.button 
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        onClick={onClose}
        className="px-8 py-4.5 text-2xs font-bold uppercase tracking-wide text-muted hover:text-[var(--text-primary)] transition-all cursor-pointer bg-transparent border-none"
      >
        {toTurkishUpperCase(cancelText)}
      </motion.button>
    </div>
 </div>
 </Modal>
 );
}
