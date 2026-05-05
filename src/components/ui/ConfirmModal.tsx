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
      <div className="flex flex-col items-center text-center py-4">
        <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 shadow-sm border ${
          isDanger ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        }`}>
          <AlertTriangle size={36} strokeWidth={1.5} />
        </div>
        
        <h3 className="text-3xl font-sans font-thin text-blue-950 mb-3 tracking-tight">{title}</h3>
        <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-blue-900/40 leading-relaxed max-w-sm mb-10 whitespace-pre-line">
          {message}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={onConfirm}
            className={`flex-1 py-4 rounded-[20px] text-[10px] font-medium uppercase tracking-[0.3em] shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-colors ${
              isDanger 
                ? 'bg-red-600/90 backdrop-blur-md text-white hover:bg-red-500' 
                : 'bg-blue-950/90 backdrop-blur-md text-white hover:bg-blue-800'
            }`}
          >
            {confirmText}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={onClose}
            className="flex-1 py-4 rounded-[20px] bg-gray-100/50 backdrop-blur-sm text-[10px] font-medium uppercase tracking-[0.3em] text-gray-500 hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}
