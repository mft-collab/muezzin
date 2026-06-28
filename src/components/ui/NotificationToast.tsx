/**
 * NotificationToast.tsx — SACRED PRECISION UPGRADE
 *
 * Değişiklikler:
 * - Konum: merkez → sağ üst (editorial)
 * - Giriş: translateY(-8px), opacity 0 → 0, sonra normal
 * - Çıkış: translateX(110%) → sağa süzülür
 * - Sol kenar chromatic status (2px): success=emerald, error=rose, info=indigo, warning=amber
 * - True Black zemin, backdrop blur
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationToastProps {
 id: string;
 title: string;
 message: string;
 type?: NotificationType;
 onClose: (id: string) => void;
}

const TYPE_CONFIG = {
 info: { borderColor: 'var(--status-info)', icon: <Info size={16} className="text-[var(--status-info)]" />, dot: 'var(--status-info)' },
 success: { borderColor: 'var(--status-success)', icon: <CheckCircle2 size={16} className="text-[var(--status-success)]" />, dot: 'var(--status-success)' },
 warning: { borderColor: 'var(--status-warning)', icon: <AlertCircle size={16} className="text-[var(--status-warning)]" />, dot: 'var(--status-warning)' },
 error: { borderColor: 'var(--status-danger)', icon: <AlertCircle size={16} className="text-[var(--status-danger)]" />, dot: 'var(--status-danger)' },
};

export const NotificationToast: React.FC<NotificationToastProps> = ({
 id,
 title,
 message,
 type = 'info',
 onClose,
}) => {
 useEffect(() => {
 const timer = setTimeout(() => onClose(id), 5500);
 return () => clearTimeout(timer);
 }, [id, onClose]);

 const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;

 return (
 <motion.div
 layout
 initial={{ opacity: 0, y: -8, x: 0 }}
 animate={{ opacity: 1, y: 0, x: 0 }}
 exit={{ opacity: 0, x: '110%', transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
 transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
 className="pointer-events-auto w-full sm:w-auto sm:min-w-[320px] max-w-full sm:max-w-[400px] spatial-glass !rounded-[24px] shadow-[var(--spatial-shadow)]"
 style={{
 borderLeftWidth: '3px',
 borderLeftColor: cfg.borderColor,
 }}
 >
 <div className="flex items-start gap-3 p-4">
 {/* Icon */}
 <div
 className="flex-shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-xl bg-[var(--text-primary)]/[0.03] border border-white/5"
 >
 {cfg.icon}
 </div>

 {/* Text */}
 <div className="flex-1 min-w-0">
 <h4 className="text-xs font-medium text-[var(--text-primary)] mb-1 leading-none">
 {title}
 </h4>
 <p className="text-[10px] font-light text-[var(--text-secondary)]/60 leading-relaxed">
 {message}
 </p>
 </div>

 {/* Close */}
 <button
 onClick={() => onClose(id)}
 className="flex-shrink-0 p-1 rounded-lg transition-colors text-[var(--text-secondary)]/20 hover:text-[var(--text-secondary)]/60"
 >
 <X size={14} />
 </button>
 </div>
 </motion.div>
 );
};

export const NotificationContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
 <div className="fixed top-4 left-4 right-4 sm:top-6 sm:right-6 sm:left-auto z-[9999] flex flex-col gap-3 pointer-events-none items-center sm:items-end">
 <AnimatePresence mode="popLayout">
 {children}
 </AnimatePresence>
 </div>
);
