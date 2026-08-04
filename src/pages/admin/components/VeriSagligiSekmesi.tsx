import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDoc, getDocs, writeBatch, doc, type DocumentData, type UpdateData } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { HeartPulse, CheckCircle2, AlertOctagon, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import type { Muezzin, Izin, HaftaPlan, Vakit } from '../../../types';

// Denetlenen belgeler tanım gereği güvenilmez olabilir (eksik/bozuk alanlar
// aranan şey) — bu yüzden `Muezzin`/`Izin`/`HaftaPlan` yerine bunların
// `Partial` hali kullanılıyor; alan adları yine de tip kontrolünden geçer.
type PersonnelDoc = Partial<Muezzin> & { id: string };
type VacationDoc = Partial<Izin> & { id: string };
type PlanDoc = Partial<HaftaPlan> & { id: string };

type RepairData =
 | { type: 'personnel_field'; docId: string; field: 'displayName' | 'role' | 'aktif'; value: string | boolean }
 | { type: 'vacation_date'; docId: string; start: string; end: string }
 | { type: 'delete_doc'; collectionName: string; docId: string }
 | { type: 'schedule_reset'; planId: string; gun: string; vakit: Vakit; field: 'asil' | 'yedek'; value: string };

interface AuditError {
 id: string;
 category: 'personnel' | 'vacation' | 'schedule';
 message: string;
 severity: 'warning' | 'critical';
 details: string;
 repairData?: RepairData;
}

export const VeriSagligiSekmesi = React.memo(() => {
 const [loading, setLoading] = useState(false);
 const [repairing, setRepairing] = useState(false);
 const [errors, setErrors] = useState<AuditError[]>([]);
 const [stats, setStats] = useState({ totalPersonnel: 0, totalVacations: 0, totalPlans: 0 });
 const [repairLogs, setRepairLogs] = useState<string[]>([]);
 const [showLogs, setShowLogs] = useState(false);
 const [auditError, setAuditError] = useState<string | null>(null);
 const [confirmRepairOpen, setConfirmRepairOpen] = useState(false);

 const runAudit = async () => {
 setLoading(true);
 setAuditError(null);
 const auditErrors: AuditError[] = [];
 setRepairLogs([]);

 try {
 let personnelList: PersonnelDoc[] = [];
 let vacationsList: VacationDoc[] = [];
 let plansList: PlanDoc[] = [];

 // Fetch muezzins
 try {
 const muezzinsSnap = await getDocs(collection(db, 'muezzins'));
 personnelList = muezzinsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PersonnelDoc));
 } catch (err) {
 console.error('Audit: Failed to fetch muezzins:', err);
 auditErrors.push({
 id: 'error-fetch-muezzins',
 category: 'personnel',
 severity: 'critical',
 message: 'Personel verileri veritabanından çekilemedi!',
 details: `Hata: ${err instanceof Error ? err.message : String(err)}. Firebase Firestore kurallarında bu koleksiyonu listeleme izniniz olduğunu kontrol edin.`
 });
 }

 // Fetch vacations
 try {
 const izinlerSnap = await getDocs(collection(db, 'izinler'));
 vacationsList = izinlerSnap.docs.map(d => ({ id: d.id, ...d.data() } as VacationDoc));
 } catch (err) {
 console.error('Audit: Failed to fetch vacations:', err);
 auditErrors.push({
 id: 'error-fetch-vacations',
 category: 'vacation',
 severity: 'critical',
 message: 'İzin verileri veritabanından çekilemedi!',
 details: `Hata: ${err instanceof Error ? err.message : String(err)}. Firebase Firestore kurallarında bu koleksiyonu listeleme izniniz olduğunu kontrol edin.`
 });
 }

 // Fetch plans
 try {
 const haftaPlanlariSnap = await getDocs(collection(db, 'haftaPlanlari'));
 plansList = haftaPlanlariSnap.docs.map(d => ({ id: d.id, ...d.data() } as PlanDoc));
 } catch (err) {
 console.error('Audit: Failed to fetch plans:', err);
 auditErrors.push({
 id: 'error-fetch-plans',
 category: 'schedule',
 severity: 'critical',
 message: 'Haftalık nöbet planları veritabanından çekilemedi!',
 details: `Hata: ${err instanceof Error ? err.message : String(err)}. Firebase Firestore kurallarında bu koleksiyonu listeleme izniniz olduğunu kontrol edin.`
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
 const gunler = plan.gunler;
 if (gunler) {
 Object.keys(gunler).forEach(gun => {
 const gunlukVakitler = gunler[gun];
 if (gunlukVakitler) {
 (Object.keys(gunlukVakitler) as Vakit[]).forEach(vakit => {
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
 } else if (asilUser.aktif === false || asilUser.role !== 'muezzin') {
 auditErrors.push({
 id: `s-asil-duty-role-${plan.id}-${gun}-${vakit}`,
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
 } else if (yedekUser.aktif === false || yedekUser.role !== 'muezzin') {
 auditErrors.push({
 id: `s-yedek-duty-role-${plan.id}-${gun}-${vakit}`,
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
 } catch (err) {
 console.error('Audit run failed: ', err);
 setAuditError(err instanceof Error ? err.message : String(err));
 } finally {
 setLoading(false);
 }
 };

 const executeAutoRepair = async () => {
 if (errors.length === 0) return;
 setConfirmRepairOpen(false);

 setRepairing(true);
 setShowLogs(true);
 const logs: string[] = [];

 const logMessage = (msg: string) => {
 const time = new Date().toLocaleTimeString('tr-TR');
 logs.push(`[${time}] ${msg}`);
 setRepairLogs([...logs]);
 };

 try {
 logMessage(`Veritabanı Onarım İşlemi Başlatıldı...`);
 logMessage(`Toplam Hata Sayısı: ${errors.length}`);

 // Temporary local object to collect schedule edits in memory to batch update documents properly
 const scheduleEdits: Record<string, HaftaPlan['gunler']> = {};
 // Tüm yazma/silme işlemleri önce burada toplanır, ardından Firestore'un
 // 500 işlemlik batch sınırını aşmamak için 400'lük parçalar halinde
 // commit edilir (bkz. SistemHatalariSekmesi.executeClearErrors) — tek
 // dev bir batch, 500+ hata olduğunda commit'in komple başarısız olup
 // hiçbir kaydın onarılmamasına yol açardı.
 const operations: Array<{ ref: ReturnType<typeof doc>; type: 'update' | 'delete'; data?: UpdateData<DocumentData> }> = [];

 for (const err of errors) {
 if (!err.repairData) continue;

 const data = err.repairData;
 if (data.type === 'personnel_field') {
 logMessage(`ONARILIYOR: Personel ${data.docId} için '${data.field}' alanı '${data.value}' yapılıyor.`);
 operations.push({ ref: doc(db, 'muezzins', data.docId), type: 'update', data: { [data.field]: data.value } });
 }
 else if (data.type === 'vacation_date') {
 logMessage(`ONARILIYOR: İzin ${data.docId} için tarih düzeltmesi uygulanıyor.`);
 operations.push({ ref: doc(db, 'izinler', data.docId), type: 'update', data: { baslangic: data.start, bitis: data.end } });
 }
 else if (data.type === 'delete_doc') {
 logMessage(`TEMİZLENİYOR: Yetim/Geçersiz belge (${data.collectionName}/${data.docId}) siliniyor.`);
 operations.push({ ref: doc(db, data.collectionName, data.docId), type: 'delete' });
 }
 else if (data.type === 'schedule_reset') {
 logMessage(`DÜZELTİLİYOR: Plan ${data.planId} -> ${data.gun} -> ${data.vakit} -> ${data.field} sistem olarak sıfırlanıyor.`);
 if (!scheduleEdits[data.planId]) {
 // Yalnızca ilgili plan dokümanı çekilir — tüm koleksiyonu indirmek
 // yerine tek bir getDoc yeterli.
 const planSnap = await getDoc(doc(db, 'haftaPlanlari', data.planId));
 scheduleEdits[data.planId] = planSnap.exists() ? JSON.parse(JSON.stringify(planSnap.data().gunler || {})) : {};
 }
 if (scheduleEdits[data.planId][data.gun] && scheduleEdits[data.planId][data.gun][data.vakit]) {
 scheduleEdits[data.planId][data.gun][data.vakit][data.field] = data.value;
 }
 }
 }

 // Add accumulated schedule batch updates
 for (const planId of Object.keys(scheduleEdits)) {
 operations.push({ ref: doc(db, 'haftaPlanlari', planId), type: 'update', data: { gunler: scheduleEdits[planId] } });
 }

 logMessage(`Değişiklikler Firebase Firestore veritabanına işleniyor...`);
 const CHUNK_SIZE = 400;
 for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
 const batch = writeBatch(db);
 operations.slice(i, i + CHUNK_SIZE).forEach((op) => {
 if (op.type === 'update') batch.update(op.ref, op.data!);
 else batch.delete(op.ref);
 });
 await batch.commit();
 }
 logMessage(`Tebrikler! Tüm veri uyuşmazlıkları başarıyla giderildi ve onarıldı.`);

 // Refresh audit list
 setTimeout(() => {
 runAudit();
 }, 1000);
 } catch (err) {
 logMessage(`ONARIM HATASI: ${err instanceof Error ? err.message : err}`);
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
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
  <div className="spatial-glass border border-[var(--glass-border)] p-4 rounded-[20px]">
  <span className="premium-label !text-2xs !opacity-30 block mb-1">SAĞLIK DURUMU</span>
  <div className="flex items-center gap-2">
  {errors.length === 0 ? (
  <>
  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
  <span className="text-xs sm:text-sm font-semibold text-emerald-400">Kararlı</span>
  </>
  ) : (
  <>
  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse" />
  <span className="text-xs sm:text-sm font-semibold text-rose-400">{errors.length} Hata</span>
  </>
  )}
  </div>
  </div>

  <div className="spatial-glass border border-[var(--glass-border)] p-4 rounded-[20px]">
  <span className="premium-label !text-2xs !opacity-30 block mb-1">MÜEZZİN KADROSU</span>
  <span className="text-sm sm:text-xl font-light text-[var(--text-primary)]">{stats.totalPersonnel} Aktif</span>
  </div>

  <div className="spatial-glass border border-[var(--glass-border)] p-4 rounded-[20px]">
  <span className="premium-label !text-2xs !opacity-30 block mb-1">ONAYLI İZİNLER</span>
  <span className="text-sm sm:text-xl font-light text-[var(--text-primary)]">{stats.totalVacations} Kayıt</span>
  </div>

  <div className="spatial-glass border border-[var(--glass-border)] p-4 rounded-[20px]">
  <span className="premium-label !text-2xs !opacity-30 block mb-1">PLANLAMA ARŞİVİ</span>
  <span className="text-sm sm:text-xl font-light text-[var(--text-primary)]">{stats.totalPlans} Plan</span>
  </div>
  </div>

 {/* Main Audit Control Screen */}
  <div className="spatial-glass border border-[var(--glass-border)] p-4 sm:p-8 rounded-[20px] sm:rounded-[28px] relative overflow-hidden bg-[var(--text-primary)]/[0.005]">
 <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--dynamic-aura,var(--aura-indigo))]/5 blur-3xl rounded-full" />
 
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
 <div>
 <h4 className="text-base font-medium text-[var(--text-primary)] flex items-center gap-2">
 <HeartPulse size={18} className="text-[var(--dynamic-aura,var(--aura-indigo))]" />
 Veritabanı Uyuşmazlık Tarayıcısı
 </h4>
 <p className="premium-label !text-2xs !opacity-30 mt-1 uppercase tracking-wider">VERİ BÜTÜNLÜĞÜ, YETİM KAYITLAR VE OTOMATİK DÜZELTME</p>
 </div>

 <div className="flex items-center gap-3">
 <motion.button
 whileHover={{ y: -2 }}
 whileTap={{ scale: 0.98 }}
 onClick={runAudit}
 disabled={loading || repairing}
 className="px-4 py-2.5 bg-[var(--text-primary)]/5 border border-[var(--glass-border)] text-[var(--text-primary)]/80 hover:bg-[var(--text-primary)]/10 rounded-xl text-2xs font-bold uppercase tracking-wide shadow-lg disabled:opacity-30 flex items-center gap-2"
 >
 <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> YENİDEN TARA
 </motion.button>

 <motion.button
 whileHover={{ y: -2 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => setConfirmRepairOpen(true)}
 disabled={errors.length === 0 || repairing || loading}
 className="px-5 py-2.5 bg-[var(--dynamic-aura,var(--aura-indigo))] hover:opacity-90 text-[var(--text-primary)] border border-[var(--dynamic-aura,var(--aura-indigo))]/60 rounded-xl text-2xs font-bold uppercase tracking-wide shadow-[0_10px_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_20%,transparent)] disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
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
 <pre className="text-2xs font-mono bg-black/40 p-4 rounded-xl text-rose-300 max-h-24 overflow-y-auto border border-rose-500/10 max-w-lg mx-auto text-left leading-relaxed">
 {auditError}
 </pre>
 <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed max-w-sm mx-auto">
 Bu hata genellikle yetki sınırlarından (Missing or insufficient permissions) veya internet bağlantı uyuşmazlıklarından kaynaklanır. Firebase Firestore kurallarında bu koleksiyonları listeleme izniniz olduğundan emin olun.
 </p>
 </div>
 ) : errors.length === 0 ? (
 <div className="p-10 text-center border border-dashed border-emerald-500/10 rounded-2xl bg-emerald-500/[0.01]">
 <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
 <CheckCircle2 size={18} />
 </div>
 <h5 className="text-xs font-semibold text-emerald-400">Veritabanı Tamamen Sağlıklı!</h5>
 <p className="text-2xs text-[var(--text-secondary)]/75 mt-1">Personeller, izinler and nöbet planları arasında hiçbir uyumsuzluk veya yetim kayıt bulunamadı.</p>
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
 <span className={`text-2xs font-bold tracking-wider px-2 py-0.5 rounded-md uppercase ${
 err.severity === 'critical' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
 }`}>
 {err.severity === 'critical' ? 'Kritik Hata' : 'Uyarı'}
 </span>
 <span className="text-2xs font-bold text-[var(--text-secondary)]/30 tracking-wide uppercase">
 Kategori: {err.category}
 </span>
 </div>
 <h5 className="text-xs font-medium text-[var(--text-primary)] mt-1.5 leading-tight">{err.message}</h5>
 <p className="text-2xs text-[var(--text-secondary)]/60 mt-1 font-sans font-light leading-relaxed">{err.details}</p>
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
 <span className="text-2xs font-bold text-[var(--dynamic-aura,var(--aura-indigo))] tracking-wide flex items-center gap-2 uppercase">
 <Terminal size={12} /> Onarım Konsol Çıktısı (Live logs)
 </span>
 <button 
 onClick={() => setShowLogs(false)} 
 className="text-2xs text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors uppercase tracking-wide font-bold"
 >
 GİZLE
 </button>
 </div>
 <pre className="text-2xs font-mono text-emerald-400/90 leading-relaxed overflow-x-auto max-h-48 p-4 rounded-xl bg-black/60 border border-[var(--text-primary)]/5 space-y-1">
 {repairLogs.length === 0 ? (
 <span className="text-[var(--text-secondary)] italic">Onarım başlatılması bekleniyor...</span>
 ) : (
 repairLogs.map((log, idx) => <div key={idx}>{log}</div>)
 )}
 </pre>
 </motion.div>
 )}
 </AnimatePresence>

 <ConfirmModal
   isOpen={confirmRepairOpen}
   onClose={() => setConfirmRepairOpen(false)}
   onConfirm={executeAutoRepair}
   title="VERİLERİ OTOMATİK ONAR"
   message={`Toplam ${errors.length} adet veri uyuşmazlığı tespit edildi. Otomatik onarım işlemine devam etmek istiyor musunuz?`}
   isDanger={false}
   confirmText="ONARIMI BAŞLAT"
 />
 </div>
 );
});
