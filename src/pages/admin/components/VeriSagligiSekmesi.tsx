import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { HeartPulse, CheckCircle2, AlertOctagon, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';

interface AuditError {
  id: string;
  category: 'personnel' | 'vacation' | 'schedule';
  message: string;
  severity: 'warning' | 'critical';
  details: string;
  repairData?: any;
}

export const VeriSagligiSekmesi = React.memo(() => {
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [errors, setErrors] = useState<AuditError[]>([]);
  const [stats, setStats] = useState({ totalPersonnel: 0, totalVacations: 0, totalPlans: 0 });
  const [repairLogs, setRepairLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setAuditError(null);
    const auditErrors: AuditError[] = [];
    setRepairLogs([]);

    try {
      let personnelList: any[] = [];
      let vacationsList: any[] = [];
      let plansList: any[] = [];

      // Fetch muezzins
      try {
        const muezzinsSnap = await getDocs(collection(db, 'muezzins'));
        personnelList = muezzinsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      } catch (err: any) {
        console.error('Audit: Failed to fetch muezzins:', err);
        auditErrors.push({
          id: 'error-fetch-muezzins',
          category: 'personnel',
          severity: 'critical',
          message: 'Personel verileri veritabanından çekilemedi!',
          details: `Hata: ${err.message || String(err)}. Firebase Firestore kurallarında bu koleksiyonu listeleme izniniz olduğunu kontrol edin.`
        });
      }

      // Fetch vacations
      try {
        const izinlerSnap = await getDocs(collection(db, 'izinler'));
        vacationsList = izinlerSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      } catch (err: any) {
        console.error('Audit: Failed to fetch vacations:', err);
        auditErrors.push({
          id: 'error-fetch-vacations',
          category: 'vacation',
          severity: 'critical',
          message: 'İzin verileri veritabanından çekilemedi!',
          details: `Hata: ${err.message || String(err)}. Firebase Firestore kurallarında bu koleksiyonu listeleme izniniz olduğunu kontrol edin.`
        });
      }

      // Fetch plans
      try {
        const haftaPlanlariSnap = await getDocs(collection(db, 'haftaPlanlari'));
        plansList = haftaPlanlariSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      } catch (err: any) {
        console.error('Audit: Failed to fetch plans:', err);
        auditErrors.push({
          id: 'error-fetch-plans',
          category: 'schedule',
          severity: 'critical',
          message: 'Haftalık nöbet planları veritabanından çekilemedi!',
          details: `Hata: ${err.message || String(err)}. Firebase Firestore kurallarında bu koleksiyonu listeleme izniniz olduğunu kontrol edin.`
        });
      }

      setStats({
        totalPersonnel: personnelList.length,
        totalVacations: vacationsList.length,
        totalPlans: plansList.length
      });

      // --- Category A: Personnel Audits ---
      personnelList.forEach(p => {
        if (!p.displayName || p.displayName.trim() === '') {
          auditErrors.push({
            id: `p-name-${p.id}`,
            category: 'personnel',
            severity: 'critical',
            message: `Personel ad/soyad alanı tanımsız veya boş!`,
            details: `ID: ${p.id} olan personelin görünen ismi boş.`,
            repairData: { type: 'personnel_field', docId: p.id, field: 'displayName', value: p.email ? p.email.split('@')[0] : `Muezzin_${p.id.slice(0, 4)}` }
          });
        }
        if (!p.role) {
          auditErrors.push({
            id: `p-role-${p.id}`,
            category: 'personnel',
            severity: 'warning',
            message: `Personel yetki rolü belirtilmemiş!`,
            details: `İsim: ${p.displayName || 'Bilinmeyen'} için varsayılan 'muezzin' rolü atanacak.`,
            repairData: { type: 'personnel_field', docId: p.id, field: 'role', value: 'muezzin' }
          });
        }
        if (p.aktif === undefined) {
          auditErrors.push({
            id: `p-aktif-${p.id}`,
            category: 'personnel',
            severity: 'warning',
            message: `Personel aktiflik statüsü tanımsız!`,
            details: `İsim: ${p.displayName || 'Bilinmeyen'} için varsayılan aktif durumu 'true' olarak set edilecek.`,
            repairData: { type: 'personnel_field', docId: p.id, field: 'aktif', value: true }
          });
        }
      });

      // --- Category B: Vacation Audits ---
      vacationsList.forEach(v => {
        if (v.baslangic && v.bitis && v.baslangic > v.bitis) {
          auditErrors.push({
            id: `v-date-${v.id}`,
            category: 'vacation',
            severity: 'critical',
            message: `Hatalı izin tarih aralığı!`,
            details: `İzin ID: ${v.id} için başlangıç tarihi (${v.baslangic}) bitiş tarihinden (${v.bitis}) sonra olamaz.`,
            repairData: { type: 'vacation_date', docId: v.id, start: v.bitis, end: v.bitis } // Auto swap or align
          });
        }
        
        const ownerExists = personnelList.some(p => p.id === v.uid);
        if (!ownerExists && v.uid) {
          auditErrors.push({
            id: `v-owner-${v.id}`,
            category: 'vacation',
            severity: 'critical',
            message: `Yetkisiz / Silinmiş Personele ait Yetim İzin!`,
            details: `İzin ID: ${v.id} sistemde bulunmayan bir personele (UID: ${v.uid}) ait.`,
            repairData: { type: 'delete_doc', collectionName: 'izinler', docId: v.id }
          });
        }
      });

      // --- Category C: Schedule Audits ---
      plansList.forEach(plan => {
        if (plan.gunler) {
          Object.keys(plan.gunler).forEach(gun => {
            const gunlukVakitler = plan.gunler[gun];
            if (gunlukVakitler) {
              Object.keys(gunlukVakitler).forEach(vakit => {
                const asil = gunlukVakitler[vakit]?.asil;
                const yedek = gunlukVakitler[vakit]?.yedek;

                if (asil && asil !== 'Sistem') {
                  const asilUser = personnelList.find(p => p.id === asil);
                  if (!asilUser) {
                    auditErrors.push({
                      id: `s-asil-exist-${plan.id}-${gun}-${vakit}`,
                      category: 'schedule',
                      severity: 'critical',
                      message: `Nöbette bulunamayan asil görevli!`,
                      details: `${gun} ${vakit.toUpperCase()} vakti asil görevlisi (UID: ${asil}) sistemde kayıtlı değil.`,
                      repairData: { type: 'schedule_reset', planId: plan.id, gun, vakit, field: 'asil', value: 'Sistem' }
                    });
                  } else if (asilUser.aktif === false) {
                    auditErrors.push({
                      id: `s-asil-active-${plan.id}-${gun}-${vakit}`,
                      category: 'schedule',
                      severity: 'warning',
                      message: `Nöbette pasif asil görevli tespit edildi!`,
                      details: `${gun} ${vakit.toUpperCase()} vakti görevlisi ${asilUser.displayName} pasif statüde.`,
                      repairData: { type: 'schedule_reset', planId: plan.id, gun, vakit, field: 'asil', value: 'Sistem' }
                    });
                  }
                }

                if (yedek && yedek !== 'Sistem') {
                  const yedekUser = personnelList.find(p => p.id === yedek);
                  if (!yedekUser) {
                    auditErrors.push({
                      id: `s-yedek-exist-${plan.id}-${gun}-${vakit}`,
                      category: 'schedule',
                      severity: 'critical',
                      message: `Nöbette bulunamayan yedek görevli!`,
                      details: `${gun} ${vakit.toUpperCase()} vakti yedek görevlisi (UID: ${yedek}) sistemde kayıtlı değil.`,
                      repairData: { type: 'schedule_reset', planId: plan.id, gun, vakit, field: 'yedek', value: 'Sistem' }
                    });
                  } else if (yedekUser.aktif === false) {
                    auditErrors.push({
                      id: `s-yedek-active-${plan.id}-${gun}-${vakit}`,
                      category: 'schedule',
                      severity: 'warning',
                      message: `Nöbette pasif yedek görevli tespit edildi!`,
                      details: `${gun} ${vakit.toUpperCase()} vakti yedeği ${yedekUser.displayName} pasif statüde.`,
                      repairData: { type: 'schedule_reset', planId: plan.id, gun, vakit, field: 'yedek', value: 'Sistem' }
                    });
                  }
                }
              });
            }
          });
        }
      });

      setErrors(auditErrors);
    } catch (err: any) {
      console.error('Audit run failed: ', err);
      setAuditError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAutoRepair = async () => {
    if (errors.length === 0) return;
    if (!window.confirm(`Toplam ${errors.length} adet veri uyuşmazlığı tespit edildi. Otomatik onarım işlemine devam etmek istiyor musunuz?`)) return;

    setRepairing(true);
    setShowLogs(true);
    const logs: string[] = [];
    const batch = writeBatch(db);

    const logMessage = (msg: string) => {
      const time = new Date().toLocaleTimeString('tr-TR');
      logs.push(`[${time}] ${msg}`);
      setRepairLogs([...logs]);
    };

    try {
      logMessage(`Veritabanı Onarım İşlemi Başlatıldı...`);
      logMessage(`Toplam Hata Sayısı: ${errors.length}`);

      // Temporary local object to collect schedule edits in memory to batch update documents properly
      const scheduleEdits: Record<string, any> = {};

      for (const err of errors) {
        if (!err.repairData) continue;

        const data = err.repairData;
        if (data.type === 'personnel_field') {
          logMessage(`ONARILIYOR: Personel ${data.docId} için '${data.field}' alanı '${data.value}' yapılıyor.`);
          const ref = doc(db, 'muezzins', data.docId);
          batch.update(ref, { [data.field]: data.value });
        } 
        else if (data.type === 'vacation_date') {
          logMessage(`ONARILIYOR: İzin ${data.docId} için tarih düzeltmesi uygulanıyor.`);
          const ref = doc(db, 'izinler', data.docId);
          batch.update(ref, { baslangic: data.start, bitis: data.end });
        } 
        else if (data.type === 'delete_doc') {
          logMessage(`TEMİZLENİYOR: Yetim/Geçersiz belge (${data.collectionName}/${data.docId}) siliniyor.`);
          const ref = doc(db, data.collectionName, data.docId);
          batch.delete(ref);
        }
        else if (data.type === 'schedule_reset') {
          logMessage(`DÜZELTİLİYOR: Plan ${data.planId} -> ${data.gun} -> ${data.vakit} -> ${data.field} sistem olarak sıfırlanıyor.`);
          if (!scheduleEdits[data.planId]) {
            // Fetch latest plan content first (it is already in our list)
            const freshPlan = await getDocs(collection(db, 'haftaPlanlari'));
            const matchedPlan = freshPlan.docs.find(d => d.id === data.planId)?.data();
            if (matchedPlan) {
              scheduleEdits[data.planId] = JSON.parse(JSON.stringify(matchedPlan.gunler || {}));
            } else {
              scheduleEdits[data.planId] = {};
            }
          }
          if (scheduleEdits[data.planId][data.gun] && scheduleEdits[data.planId][data.gun][data.vakit]) {
            scheduleEdits[data.planId][data.gun][data.vakit][data.field] = data.value;
          }
        }
      }

      // Add accumulated schedule batch updates
      for (const planId of Object.keys(scheduleEdits)) {
        const ref = doc(db, 'haftaPlanlari', planId);
        batch.update(ref, { gunler: scheduleEdits[planId] });
      }

      logMessage(`Değişiklikler Firebase Firestore veritabanına işleniyor...`);
      await batch.commit();
      logMessage(`Tebrikler! Tüm veri uyuşmazlıkları başarıyla giderildi ve onarıldı.`);
      
      // Refresh audit list
      setTimeout(() => {
        runAudit();
      }, 1000);
    } catch (err: any) {
      logMessage(`ONARIM HATASI: ${err.message || err}`);
    } finally {
      setRepairing(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="spatial-glass border border-[var(--glass-border)] p-6 rounded-[24px]">
          <span className="premium-label !text-[8px] !opacity-30 block mb-1">SAĞLIK DURUMU</span>
          <div className="flex items-center gap-3">
            {errors.length === 0 ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                <span className="text-sm font-semibold text-emerald-400">Kararlı & Kusursuz</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse" />
                <span className="text-sm font-semibold text-rose-400">{errors.length} Uyuşmazlık</span>
              </>
            )}
          </div>
        </div>

        <div className="spatial-glass border border-[var(--glass-border)] p-6 rounded-[24px]">
          <span className="premium-label !text-[8px] !opacity-30 block mb-1">MÜEZZİN KADROSU</span>
          <span className="text-xl font-light text-[var(--text-primary)]">{stats.totalPersonnel} Aktif Kayıt</span>
        </div>

        <div className="spatial-glass border border-[var(--glass-border)] p-6 rounded-[24px]">
          <span className="premium-label !text-[8px] !opacity-30 block mb-1">ONAYLI İZİNLER</span>
          <span className="text-xl font-light text-[var(--text-primary)]">{stats.totalVacations} Kayıt</span>
        </div>

        <div className="spatial-glass border border-[var(--glass-border)] p-6 rounded-[24px]">
          <span className="premium-label !text-[8px] !opacity-30 block mb-1">PLANLAMA ARŞİVİ</span>
          <span className="text-xl font-light text-[var(--text-primary)]">{stats.totalPlans} Hafta Planı</span>
        </div>
      </div>

      {/* Main Audit Control Screen */}
      <div className="spatial-glass border border-[var(--glass-border)] p-8 rounded-[28px] relative overflow-hidden bg-[var(--text-primary)]/[0.005]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
          <div>
            <h4 className="text-base font-medium text-[var(--text-primary)] flex items-center gap-2">
              <HeartPulse size={18} className="text-indigo-400" />
              Veritabanı Uyuşmazlık Tarayıcısı
            </h4>
            <p className="premium-label !text-[8px] !opacity-30 mt-1 uppercase tracking-wider">VERİ BÜTÜNLÜĞÜ, YETİM KAYITLAR VE OTOMATİK DÜZELTME</p>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={runAudit}
              disabled={loading || repairing}
              className="px-4 py-2.5 bg-white/5 border border-[var(--glass-border)] text-[var(--text-primary)]/80 hover:bg-white/10 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] shadow-lg disabled:opacity-30 flex items-center gap-2"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> YENİDEN TARA
            </motion.button>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAutoRepair}
              disabled={errors.length === 0 || repairing || loading}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white border border-indigo-400 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] shadow-[0_10px_20px_rgba(99,102,241,0.2)] disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
            >
              <ShieldCheck size={12} /> OTOMATİK ONAR
            </motion.button>
          </div>
        </div>

        {/* List of Detected Issues */}
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {loading ? (
            <div className="py-16 text-center text-xs text-[var(--text-secondary)]/50 tracking-wider">
              Veritabanı taranıyor, lütfen bekleyin...
            </div>
          ) : auditError ? (
            <div className="p-10 text-center border border-dashed border-rose-500/20 rounded-2xl bg-rose-500/[0.01] space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
                <AlertOctagon size={18} />
              </div>
              <h5 className="text-xs font-semibold text-rose-400">Veri Tarama Hatası Oluştu</h5>
              <pre className="text-[10px] font-mono bg-black/40 p-4 rounded-xl text-rose-300 max-h-24 overflow-y-auto border border-rose-500/10 max-w-lg mx-auto text-left leading-relaxed">
                {auditError}
              </pre>
              <p className="text-[9px] text-[var(--text-secondary)]/50 leading-relaxed max-w-sm mx-auto">
                Bu hata genellikle yetki sınırlarından (Missing or insufficient permissions) veya internet bağlantı uyuşmazlıklarından kaynaklanır. Firebase Firestore kurallarında bu koleksiyonları listeleme izniniz olduğundan emin olun.
              </p>
            </div>
          ) : errors.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-emerald-500/10 rounded-2xl bg-emerald-500/[0.01]">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <CheckCircle2 size={18} />
              </div>
              <h5 className="text-xs font-semibold text-emerald-400">Veritabanı Tamamen Sağlıklı!</h5>
              <p className="text-[10px] text-[var(--text-secondary)]/40 mt-1">Personeller, izinler and nöbet planları arasında hiçbir uyumsuzluk veya yetim kayıt bulunamadı.</p>
            </div>
          ) : (
            errors.map((err) => (
              <div 
                key={err.id}
                className={`p-5 rounded-2xl border flex items-start gap-4 transition-colors ${
                  err.severity === 'critical' 
                    ? 'bg-rose-500/[0.02] border-rose-500/10 hover:bg-rose-500/[0.04]' 
                    : 'bg-amber-500/[0.02] border-amber-500/10 hover:bg-amber-500/[0.04]'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  err.severity === 'critical' 
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  <AlertOctagon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[8px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase ${
                      err.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {err.severity === 'critical' ? 'Kritik Hata' : 'Uyarı'}
                    </span>
                    <span className="text-[8px] font-bold text-[var(--text-secondary)]/30 tracking-widest uppercase">
                      Kategori: {err.category}
                    </span>
                  </div>
                  <h5 className="text-xs font-medium text-[var(--text-primary)] mt-1.5 leading-tight">{err.message}</h5>
                  <p className="text-[10px] text-[var(--text-secondary)]/60 mt-1 font-sans font-light leading-relaxed">{err.details}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Terminal Log Console */}
      <AnimatePresence>
        {showLogs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="spatial-glass border border-[var(--glass-border)] p-6 rounded-[28px] bg-black/40 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-bold text-indigo-400 tracking-[0.2em] flex items-center gap-2 uppercase">
                <Terminal size={12} /> Onarım Konsol Çıktısı (Live logs)
              </span>
              <button 
                onClick={() => setShowLogs(false)} 
                className="text-[9px] text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors uppercase tracking-widest font-bold"
              >
                GİZLE
              </button>
            </div>
            <pre className="text-[9px] font-mono text-emerald-400/90 leading-relaxed overflow-x-auto max-h-48 p-4 rounded-xl bg-black/60 border border-white/5 space-y-1">
              {repairLogs.length === 0 ? (
                <span className="text-white/30 italic">Onarım başlatılması bekleniyor...</span>
              ) : (
                repairLogs.map((log, idx) => <div key={idx}>{log}</div>)
              )}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
