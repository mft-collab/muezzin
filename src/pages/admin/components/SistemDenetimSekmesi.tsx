import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ClipboardList, Shield, User } from 'lucide-react';

interface AuditLog {
  id: string;
  actionType: string;
  targetName: string;
  details: string;
  userId: string;
  userDisplayName: string;
  timestamp: any;
}

export const SistemDenetimSekmesi = React.memo(({ formatDate }: { formatDate: (ts: any) => string }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const auditQuery = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(30));
    const unsub = onSnapshot(auditQuery, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }, (err) => console.error("Audit logs listen error:", err));
    return () => unsub();
  }, []);

  const getActionBadgeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('sil') || t.includes('arşiv') || t.includes('red')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (t.includes('ekle') || t.includes('onay') || t.includes('oluştur')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (t.includes('güncelle') || t.includes('düzenle') || t.includes('kaydet')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] border-[var(--dynamic-aura,var(--aura-indigo))]/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <ClipboardList size={16} className="text-[var(--dynamic-aura,var(--aura-indigo))]" />
          Yönetici Denetim İzleri (Audit Logs)
        </h4>
        <span className="premium-label !text-[9px] !opacity-20">{logs.length} SON İŞLEM LİSTELENDİ</span>
      </div>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="p-16 text-center border border-dashed border-[var(--glass-border)] rounded-[28px] bg-[var(--text-primary)]/[0.01]">
            <div className="w-12 h-12 rounded-full bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] flex items-center justify-center mx-auto mb-4 border border-[var(--dynamic-aura,var(--aura-indigo))]/20">
              <Shield size={20} />
            </div>
            <p className="text-sm text-[var(--text-primary)] font-light">Kayıt Bulunmuyor</p>
            <p className="premium-label !text-[10px] !opacity-30 mt-1">SİSTEMDE HENÜZ HİÇBİR YÖNETİCİ İŞLEMİ KAYDEDİLMEMİŞ.</p>
          </div>
        ) : (
          logs.map((log) => (
            <motion.div
              layout
              key={log.id}
              className="spatial-glass border border-[var(--glass-border)] p-5 rounded-[24px] hover:bg-[var(--text-primary)]/[0.02] transition-colors"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[14px] bg-white/[0.03] border border-white/5 flex items-center justify-center text-[var(--dynamic-aura,var(--aura-indigo))] flex-shrink-0 shadow-lg">
                    <User size={18} />
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2.5">
                      <span className="text-sm font-medium text-[var(--text-primary)] tracking-tight">
                        {log.userDisplayName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${getActionBadgeColor(log.actionType)}`}>
                        {log.actionType}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]/70 mt-1 font-light leading-relaxed">
                      <span className="font-semibold text-white/50">{log.targetName}:</span> {log.details}
                    </p>
                  </div>
                </div>
                <div className="text-right sm:flex-shrink-0">
                  <span className="text-[10px] text-[var(--text-secondary)]/50 font-bold block">
                    {formatDate(log.timestamp)}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]/20 font-mono block mt-1">
                    LOG ID: {log.id}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
});
