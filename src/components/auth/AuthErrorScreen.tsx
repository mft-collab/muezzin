import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface AuthErrorScreenProps {
 error: string;
 setError: (err: string | null) => void;
 setLoading: (loading: boolean) => void;
 logout: () => void;
}

export function AuthErrorScreen({ error, setError, setLoading, logout }: AuthErrorScreenProps) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] p-6">
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="max-w-md w-full spatial-glass rounded-[32px] shadow-[var(--spatial-shadow)] p-10 text-center border border-[var(--glass-border)]"
 >
 <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
 <AlertCircle className="w-10 h-10 text-red-500" />
 </div>
 <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4 tracking-tight">Giriş Yapılamadı</h2>
 <div className="bg-red-500/5 p-4 rounded-2xl mb-8 text-left border border-red-500/10">
 <p className="text-sm text-red-500 leading-relaxed font-medium">{error}</p>
 </div>
 <div className="space-y-3">
 <button
 onClick={() => { setError(null); setLoading(false); }}
 className="w-full h-14 bg-blue-600 text-[var(--text-primary)] rounded-2xl font-medium shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all "
 >
 TEKRAR DENE
 </button>
 <button
 onClick={logout}
 className="w-full h-14 bg-[var(--text-primary)]/5 text-[var(--text-primary)] rounded-2xl font-medium hover:bg-[var(--text-primary)]/10 transition-all "
 >
 BAŞKA HESAP KULLAN
 </button>
 </div>
 </motion.div>
 </div>
 );
}
