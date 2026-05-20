import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ShieldAlert, CheckCircle, Trash2 } from 'lucide-react';

interface ErrorLog {
  id: string;
  errorMessage: string;
  errorStack: string;
  componentStack?: string;
  userId: string;
  device: { os: string; browser: string; screenSize: string; pwaMode: boolean; };
  timestamp: any;
}

export const SistemHatalariSekmesi = React.memo(({ formatDate }: { formatDate: (ts: any) => string }) => {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [selectedError, setSelectedError] = useState<string | null>(null);

  useEffect(() => {
    const errorsQuery = query(collection(db, 'error_logs'), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(errorsQuery, (snap) => {
      setErrorLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ErrorLog)));
    }, (err) => console.error("Error logs listen error:", err));
    return () => unsub();
  }, []);

  const clearErrors = async () => {
    if (!window.confirm("Tüm hata günlüklerini kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try {
      const snap = await getDocs(collection(db, 'error_logs'));
      const batch = writeBatch(db);
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      console.error("Hatalar temizlenemedi:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-500" />
          Aktif Sistem Hataları
        </h4>
        <motion.button
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={clearErrors}
          disabled={errorLogs.length === 0}
          className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] shadow-lg disabled:opacity-30 transition-all flex items-center gap-2"
        >
          <Trash2 size={12} /> TEMİZLE
        </motion.button>
      </div>

      <div className="space-y-4">
        {errorLogs.length === 0 ? (
          <div className="p-16 text-center border border-dashed border-[var(--glass-border)] rounded-[28px] bg-[var(--text-primary)]/[0.01]">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <CheckCircle size={20} />
            </div>
            <p className="text-sm text-[var(--text-primary)] font-light">Mükemmel Durum!</p>
            <p className="premium-label !text-[8px] !opacity-30 mt-1">SİSTEMDE HİÇBİR KRİTİK ÇÖKME VEYA HATA BULUNMUYOR.</p>
          </div>
        ) : (
          errorLogs.map((log) => (
            <motion.div
              layout
              key={log.id}
              className={`spatial-glass border border-[var(--glass-border)] p-6 rounded-[28px] transition-all hover:bg-[var(--text-primary)]/[0.02] cursor-pointer ${
                selectedError === log.id ? 'ring-1 ring-rose-500/20' : ''
              }`}
              onClick={() => setSelectedError(selectedError === log.id ? null : log.id)}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0 border border-rose-500/20">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-rose-500/90 leading-tight pr-8">{log.errorMessage}</h4>
                    <div className="flex flex-wrap gap-2.5 mt-3" onClick={(e) => e.stopPropagation()}>
                      <span className="px-2.5 py-1 bg-[var(--text-primary)]/[0.03] text-[9px] font-sans font-light rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)]">OS: {log.device?.os}</span>
                      <span className="px-2.5 py-1 bg-[var(--text-primary)]/[0.03] text-[9px] font-sans font-light rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)]">Tarayıcı: {log.device?.browser}</span>
                      <span className="px-2.5 py-1 bg-[var(--text-primary)]/[0.03] text-[9px] font-sans font-light rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)]">Ekran: {log.device?.screenSize}</span>
                      {log.device?.pwaMode && (
                        <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-bold tracking-wider rounded-lg uppercase">PWA YÜKLÜ</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right sm:flex-shrink-0">
                  <span className="text-[10px] text-[var(--text-secondary)]/50 font-bold block">{formatDate(log.timestamp)}</span>
                  <span className="text-[8px] text-[var(--text-secondary)]/30 font-mono block mt-1">ID: {log.id}</span>
                </div>
              </div>

              <AnimatePresence>
                {selectedError === log.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mt-6 pt-6 border-t border-[var(--glass-border)] space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <span className="premium-label !text-[8px] !opacity-30 block mb-2">HATA ÇAĞRI YIĞINI (STACK TRACE)</span>
                      <pre className="text-[10px] font-mono p-4 rounded-2xl bg-[var(--text-primary)]/[0.03] text-[var(--text-secondary)] overflow-x-auto max-h-48 leading-relaxed">
                        {log.errorStack}
                      </pre>
                    </div>

                    {log.componentStack && (
                      <div>
                        <span className="premium-label !text-[8px] !opacity-30 block mb-2">BİLEŞEN YAPISI (COMPONENT TREE)</span>
                        <pre className="text-[10px] font-mono p-4 rounded-2xl bg-[var(--text-primary)]/[0.03] text-[var(--text-secondary)] overflow-x-auto max-h-48 leading-relaxed">
                          {log.componentStack}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
});
