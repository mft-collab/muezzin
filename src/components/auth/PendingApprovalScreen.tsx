import React from 'react';
import { motion } from 'motion/react';
import { Logo } from '../ui/Logo';
import { auth } from '../../lib/firebase';

interface PendingApprovalScreenProps {
 logout: () => void;
}

export function PendingApprovalScreen({ logout }: PendingApprovalScreenProps) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--app-bg)] p-6 selection:bg-blue-900 selection:text-blue-100">
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="spatial-glass backdrop-blur-2xl p-10 rounded-[40px] shadow-[var(--spatial-shadow)] max-w-md w-full text-center border border-[var(--glass-border)]"
 >
 <div className="w-20 h-20 bg-[var(--text-primary)]/5 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm ring-1 ring-[var(--glass-border)]">
 <Logo size={48} variant="gold" />
 </div>
 <h1 className="text-2xl font-semibold mb-3 text-[var(--text-primary)] tracking-tight">Onay Bekleniyor</h1>
 <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
 Sisteme kaydınız yapıldı fakat hesabınız henüz yönetici tarafından aktif edilmedi.
 </p>
 <div className="bg-blue-500/5 p-5 rounded-2xl text-xs text-blue-600 mb-10 text-left border border-blue-500/10 space-y-1">
 <div className="flex justify-between border-b border-blue-500/10 pb-1 mb-1">
 <span className="opacity-50 text-[var(--text-secondary)]">Ad Soyad:</span>
 <span className="font-bold text-[var(--text-primary)]">{auth.currentUser?.displayName}</span>
 </div>
 <div className="flex justify-between">
 <span className="opacity-50 text-[var(--text-secondary)]">E-posta:</span>
 <span className="font-bold text-[var(--text-primary)]">{auth.currentUser?.email}</span>
 </div>
 </div>
 <button 
 onClick={logout} 
 className="w-full h-12 text-[var(--text-secondary)] font-medium hover:text-red-500 transition-colors uppercase text-[10px] tracking-wide"
 >
 GİRİŞ YAPILAN HESAPTAN ÇIK
 </button>
 </motion.div>
 </div>
 );
}
