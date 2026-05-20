import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, className = '', contentClassName = '' }: ModalProps) {
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
        <div className={`fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 ${className}`}>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 dark:bg-black/90 backdrop-blur-md"
          >
            {/* Modal-specific Ambient Aura */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_50%_50%,var(--aura-indigo),transparent_60%)] opacity-5 pointer-events-none" />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", stiffness: 400, damping: 35, mass: 1 }}
            className={`spatial-glass phi-padding w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden relative z-10 shadow-2xl ${contentClassName}`}
          >
            <div className="flex justify-between items-start mb-10">
              <div>
                 <p className="authority-title text-[7px] opacity-30 mb-3 uppercase">SİSTEM BİLGİ KATMANI</p>
                 <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-[var(--text-primary)] apple-thin">{title}</h2>
              </div>
              <button 
                onClick={onClose} 
                className="w-12 h-12 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] hover:text-rose-500 rounded-[20px] flex items-center justify-center border border-[var(--glass-border)] transition-all active:scale-95 text-[var(--text-primary)]"
              >
                <X size={20} strokeWidth={1} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 no-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
