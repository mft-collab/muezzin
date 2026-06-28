import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ShieldAlert, CheckCircle, Trash2, Wifi, WifiOff, Cpu, Navigation, Layers, Activity, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import type { EnrichedErrorLog, Breadcrumb } from '../../../services/telemetryService';

interface ErrorLog extends Partial<EnrichedErrorLog> {
  id: string;
  errorMessage: string;
  userId: string;
  timestamp: any;
  device: { os: string; browser: string; screenSize: string; pwaMode: boolean; language: string };
}

const categoryColors: Record<Breadcrumb['category'], string> = {
  navigation: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  user_action: 'text-[var(--dynamic-aura,var(--aura-indigo))] bg-[var(--dynamic-aura,var(--aura-indigo))]/10 border-[var(--dynamic-aura,var(--aura-indigo))]/20',
  network: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  system: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
};

const categoryLabels: Record<Breadcrumb['category'], string> = {
  navigation: 'NAVİGASYON',
  user_action: 'KULLANICI',
  network: 'AĞ',
  system: 'SİSTEM',
};

function BreadcrumbTrail({ breadcrumbs }: { breadcrumbs: Breadcrumb[] }) {
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return (
      <p className="text-[10px] text-[var(--text-secondary)]/30 italic font-light">
        Bu hata için breadcrumb verisi bulunmuyor.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar pr-1">
      {breadcrumbs.map((crumb, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.02 }}
          className="flex items-start gap-2.5"
        >
          {/* Zaman Çizelgesi Çizgisi */}
          <div className="flex flex-col items-center flex-shrink-0 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full border ${categoryColors[crumb.category]}`} />
            {i < breadcrumbs.length - 1 && (
              <div className="w-px h-3 bg-[var(--glass-border)] mt-0.5" />
            )}
          </div>
          <div className="flex-1 pb-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-widest ${categoryColors[crumb.category]}`}>
                {categoryLabels[crumb.category]}
              </span>
              <span className="text-[10px] text-[var(--text-primary)]/80 font-light leading-tight truncate">
                {crumb.action}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock size={8} className="text-[var(--text-secondary)]/30 flex-shrink-0" />
              <span className="text-[8px] font-mono text-[var(--text-secondary)]/30">
                {crumb.wallTime ? new Date(crumb.wallTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }) : `+${crumb.timestamp}ms`}
              </span>
              {crumb.data && Object.keys(crumb.data).length > 0 && (
                <span className="text-[7px] font-mono text-[var(--text-secondary)]/20 truncate">
                  {JSON.stringify(crumb.data).slice(0, 60)}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function StateSnapshotCard({ snapshot }: { snapshot: EnrichedErrorLog['stateSnapshot'] }) {
  if (!snapshot) {
    return (
      <p className="text-[10px] text-[var(--text-secondary)]/30 italic font-light">
        Bu hata için durum fotoğrafı bulunmuyor.
      </p>
    );
  }

  const items = [
    { label: 'Aktif Yol', value: snapshot.currentPath, icon: Navigation },
    { label: 'Tema', value: snapshot.theme || 'Bilinmeyen', icon: Layers },
    { label: 'GPS', value: snapshot.gpsEnabled ? 'Aktif ✓' : 'Pasif', icon: Navigation },
    { label: 'Ağ Durumu', value: snapshot.isOnline ? 'Çevrimiçi' : 'Çevrimdışı', icon: snapshot.isOnline ? Wifi : WifiOff },
    { label: 'Ağ Tipi', value: snapshot.networkType, icon: Activity },
    { label: 'RTT Gecikmesi', value: snapshot.networkRtt != null ? `${snapshot.networkRtt} ms` : 'Bilinmiyor', icon: Activity },
    { label: 'Bellek', value: snapshot.memoryUsedMb != null ? `${snapshot.memoryUsedMb} MB` : 'Bilinmiyor', icon: Cpu },
    { label: 'PWA SW', value: snapshot.swVersion || 'Bilinmiyor', icon: Layers },
    { label: 'SW Durumu', value: snapshot.swState || 'Bilinmiyor', icon: Layers },
    { label: 'Kullanıcı Rolü', value: snapshot.authRole || 'Yok', icon: ShieldAlert },
    { label: 'Uygulama Sürümü', value: snapshot.appVersion, icon: Cpu },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="px-3 py-2 rounded-xl bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] flex items-start gap-2">
          <Icon size={10} className="text-[var(--text-secondary)]/30 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[7px] text-[var(--text-secondary)]/40 uppercase tracking-wider leading-none mb-0.5">{label}</p>
            <p className="text-[10px] text-[var(--text-primary)]/80 font-medium truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export const SistemHatalariSekmesi = React.memo(({ formatDate }: { formatDate: (ts: any) => string }) => {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'stack' | 'breadcrumbs' | 'snapshot'>('stack');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    const errorsQuery = query(collection(db, 'error_logs'), orderBy('timestamp', 'desc'), limit(20));
    const unsub = onSnapshot(errorsQuery, (snap) => {
      setErrorLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ErrorLog)));
    }, (err) => console.error('Error logs listen error:', err));
    return () => unsub();
  }, []);

  const executeClearErrors = async () => {
    try {
      const snap = await getDocs(collection(db, 'error_logs'));
      const batch = writeBatch(db);
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      setConfirmClearOpen(false);
    } catch (err) {
      console.error('Hatalar temizlenemedi:', err);
      setConfirmClearOpen(false);
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
          onClick={() => setConfirmClearOpen(true)}
          disabled={errorLogs.length === 0}
          className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-[9px] font-bold uppercase tracking-wide shadow-lg disabled:opacity-30 transition-all flex items-center gap-2"
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
          errorLogs.map((log) => {
            const isOpen = selectedError === log.id;
            const breadcrumbCount = log.breadcrumbs?.length ?? 0;
            const hasSnapshot = !!log.stateSnapshot;

            return (
              <motion.div
                layout
                key={log.id}
                className={`spatial-glass border border-[var(--glass-border)] p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] transition-all cursor-pointer ${isOpen ? 'ring-1 ring-rose-500/20' : 'hover:bg-[var(--text-primary)]/[0.02]'}`}
                onClick={() => {
                  setSelectedError(isOpen ? null : log.id);
                  setActivePanel('stack');
                }}
              >
                {/* ─── Üst Satır ─── */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0 border border-rose-500/20">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-rose-500/90 leading-tight pr-2">{log.errorMessage}</h4>

                      {/* Cihaz Etiketleri */}
                      <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        <span className="px-2.5 py-1 bg-[var(--text-primary)]/[0.03] text-[9px] font-sans font-light rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)]">OS: {log.device?.os}</span>
                        <span className="px-2.5 py-1 bg-[var(--text-primary)]/[0.03] text-[9px] font-sans font-light rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)]">Tarayıcı: {log.device?.browser}</span>
                        <span className="px-2.5 py-1 bg-[var(--text-primary)]/[0.03] text-[9px] font-sans font-light rounded-lg border border-[var(--glass-border)] text-[var(--text-secondary)]">Ekran: {log.device?.screenSize}</span>
                        {log.device?.pwaMode && (
                          <span className="px-2.5 py-1 bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] border border-[var(--dynamic-aura,var(--aura-indigo))]/20 text-[8px] font-bold tracking-wider rounded-lg uppercase">PWA YÜKLÜ</span>
                        )}
                        {breadcrumbCount > 0 && (
                          <span className="px-2.5 py-1 bg-sky-400/10 text-sky-400 border border-sky-400/20 text-[8px] font-bold tracking-wider rounded-lg uppercase">
                            {breadcrumbCount} KIRINIK
                          </span>
                        )}
                        {hasSnapshot && (
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-bold tracking-wider rounded-lg uppercase">
                            DURUM FOTOĞRAFI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:flex-shrink-0 flex flex-col items-end gap-2">
                    <span className="text-[10px] text-[var(--text-secondary)]/50 font-bold block">{formatDate(log.timestamp)}</span>
                    <span className="text-[8px] text-[var(--text-secondary)]/30 font-mono block">ID: {log.id}</span>
                    <div className="text-[var(--text-secondary)]/30">
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </div>

                {/* ─── Açılan Detay Paneli ─── */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden mt-6 pt-6 border-t border-[var(--glass-border)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Panel Sekme Seçici */}
                      <div className="flex gap-1 mb-5 p-1 bg-[var(--text-primary)]/[0.03] rounded-2xl border border-[var(--glass-border)] w-full sm:w-fit overflow-x-auto no-scrollbar">
                        {[
                          { key: 'stack', label: 'Stack Trace', icon: AlertTriangle },
                          { key: 'breadcrumbs', label: `Kullanıcı İzleri (${breadcrumbCount})`, icon: Activity },
                          { key: 'snapshot', label: 'Durum Fotoğrafı', icon: Cpu },
                        ].map(({ key, label, icon: Icon }) => (
                          <button
                            key={key}
                            onClick={() => setActivePanel(key as any)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wide transition-all ${
                              activePanel === key
                                ? 'bg-[var(--text-primary)]/[0.07] text-[var(--text-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)]/40 hover:text-[var(--text-secondary)]/70'
                            }`}
                          >
                            <Icon size={10} />
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* ─── Stack Trace ─── */}
                      {activePanel === 'stack' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-4"
                        >
                          <div>
                            <span className="premium-label !text-[8px] !opacity-30 block mb-2">HATA ÇAĞRI YIĞINI (STACK TRACE)</span>
                            <pre className="text-[10px] font-mono p-4 rounded-2xl bg-[var(--text-primary)]/[0.03] text-rose-400/70 overflow-x-auto max-h-48 leading-relaxed">
                              {log.errorStack || 'Stack trace mevcut değil.'}
                            </pre>
                          </div>
                          {log.componentStack && (
                            <div>
                              <span className="premium-label !text-[8px] !opacity-30 block mb-2">BİLEŞEN YAPISI (COMPONENT TREE)</span>
                              <pre className="text-[10px] font-mono p-4 rounded-2xl bg-[var(--text-primary)]/[0.03] text-[var(--text-secondary)]/60 overflow-x-auto max-h-48 leading-relaxed">
                                {log.componentStack}
                              </pre>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* ─── Breadcrumb Kullanıcı İzleri ─── */}
                      {activePanel === 'breadcrumbs' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <span className="premium-label !text-[8px] !opacity-30 block mb-4">
                            KULLANICI EYLEM KRİNTI İZLERİ — HATADAN ÖNCEKİ {breadcrumbCount} ADIM
                          </span>
                          <BreadcrumbTrail breadcrumbs={log.breadcrumbs || []} />
                        </motion.div>
                      )}

                      {/* ─── Durum Fotoğrafı ─── */}
                      {activePanel === 'snapshot' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <span className="premium-label !text-[8px] !opacity-30 block mb-4">
                            HATA ANINDAKİ UYGULAMA DURUM FOTOĞRAFI
                          </span>
                          <StateSnapshotCard snapshot={log.stateSnapshot} />
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={executeClearErrors}
        title="HATA GÜNLÜKLERİNİ TEMİZLE"
        message="Tüm sistem hata günlükleri kalıcı olarak silinecektir. Bu işlem geri alınamaz."
        isDanger={true}
        confirmText="EVET, TÜMÜNÜ SİL"
      />
    </div>
  );
});
