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
        <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-10 border border-white/[0.03] ${
          isDanger ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]' : 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]'
        }`}>
          <AlertTriangle size={32} strokeWidth={1} />
        </div>
        
        <p className="authority-title !text-[8px] leading-relaxed max-w-sm mb-14 opacity-40">
          {message.toUpperCase()}
        </p>
        
        <div className="flex items-center gap-4 w-full">
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            className={`flex-1 py-4.5 rounded-[20px] text-[8px] font-bold uppercase tracking-[0.25em] transition-all ${
              isDanger 
                ? 'bg-rose-500 text-white hover:bg-rose-600' 
                : 'bg-[var(--text-primary)] text-[var(--app-bg)]'
            }`}
          >
            {confirmText.toUpperCase()}
          </motion.button>
          <button 
            onClick={onClose}
            className="px-8 py-4.5 text-[8px] font-bold uppercase tracking-[0.25em] text-[var(--text-primary)]/30 hover:text-[var(--text-primary)] transition-colors"
          >
            {cancelText.toUpperCase()}
          </button>
        </div>
      </div>
    </Modal>
  );
}
