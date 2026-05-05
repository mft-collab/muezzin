import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-blue-950/40 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-white/80 backdrop-blur-2xl rounded-[40px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/40 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden relative z-10"
          >
            <div className="flex justify-between items-center p-6 border-b border-blue-50">
              <h2 className="text-xl font-sans font-thin tracking-tight text-blue-950">{title}</h2>
              <button onClick={onClose} className="p-2 bg-blue-50/50 hover:bg-blue-100 text-blue-950/50 hover:text-blue-950 rounded-full transition-colors">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
