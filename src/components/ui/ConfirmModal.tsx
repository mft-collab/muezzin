import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

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
        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.15)] animate-float' 
        : 'bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20 text-[var(--status-warning)] shadow-[0_0_25px_rgba(245,158,11,0.15)]'
    }`}>
      <AlertTriangle size={32} strokeWidth={1.2} />
    </div>
    
    <p className="premium-label !text-[11px] leading-relaxed max-w-sm mb-12 opacity-65 dark:opacity-40 tracking-wide px-4">
      {message.toUpperCase()}
    </p>
    
    <div className="flex items-center gap-4 w-full px-4">
      <motion.button 
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onConfirm}
        className={`flex-1 py-4.5 rounded-[20px] text-[11px] font-bold uppercase tracking-wide transition-all border-none cursor-pointer ${
          isDanger 
            ? 'bg-rose-500 text-[var(--text-primary)] shadow-[0_4px_15px_-3px_rgba(244,63,94,0.4)] hover:shadow-[0_8px_25px_-5px_rgba(244,63,94,0.6)]' 
            : 'neural-btn'
        }`}
      >
        {confirmText.toUpperCase()}
      </motion.button>
      <motion.button 
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        onClick={onClose}
        className="px-8 py-4.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-all cursor-pointer bg-transparent border-none"
      >
        {cancelText.toUpperCase()}
      </motion.button>
    </div>
 </div>
 </Modal>
 );
}
