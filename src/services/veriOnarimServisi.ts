import { collection, getDoc, getDocs, writeBatch, doc, type DocumentData, type UpdateData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Muezzin, Izin, HaftaPlan, Vakit } from '../types';

// Denetlenen belgeler tanım gereği güvenilmez olabilir (eksik/bozuk alanlar
// aranan şey) — bu yüzden `Muezzin`/`Izin`/`HaftaPlan` yerine bunların
// `Partial` hali kullanılıyor; alan adları yine de tip kontrolünden geçer.
export type PersonnelDoc = Partial<Muezzin> & { id: string };
export type VacationDoc = Partial<Izin> & { id: string };
export type PlanDoc = Partial<HaftaPlan> & { id: string };

export type RepairData =
 | { type: 'personnel_field'; docId: string; field: 'displayName' | 'role' | 'aktif'; value: string | boolean }
 | { type: 'vacation_date'; docId: string; start: string; end: string }
 | { type: 'delete_doc'; collectionName: string; docId: string }
 | { type: 'schedule_reset'; planId: string; gun: string; vakit: Vakit; field: 'asil' | 'yedek'; value: string };

export interface AuditError {
 id: string;
 category: 'personnel' | 'vacation' | 'schedule';
 message: string;
 severity: 'warning' | 'critical';
 details: string;
 repairData?: RepairData;
}

export interface VeriSagligiTaramaSonucu {
 errors: AuditError[];
 stats: { totalPersonnel: number; totalVacations: number; totalPlans: number };
 /** Denetimin kendisi (koleksiyon okumaları dışında) çöktüyse dolu gelir — bu durumda `errors` güvenilir değildir. */
 auditError: string | null;
}

/** muezzins/izinler/haftaPlanlari koleksiyonlarını tarar; alan eksikliği, yetim kayıt ve tutarsız nöbet ataması tespit eder. */
export async function veriSagligiTara(): Promise<VeriSagligiTaramaSonucu> {
 const auditErrors: AuditError[] = [];

 try {
 let personnelList: PersonnelDoc[] = [];
 let vacationsList: VacationDoc[] = [];
 let plansList: PlanDoc[] = [];

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

 const stats = {
 totalPersonnel: personnelList.length,
 totalVacations: vacationsList.length,
 totalPlans: plansList.length
 };

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

 return { errors: auditErrors, stats, auditError: null };
 } catch (err) {
 console.error('Audit run failed: ', err);
 return {
 errors: [],
 stats: { totalPersonnel: 0, totalVacations: 0, totalPlans: 0 },
 auditError: err instanceof Error ? err.message : String(err),
 };
 }
}

/** `veriSagligiTara`'nın bulduğu hataları, her birinin `repairData`sına göre otomatik onarır. İlerleme `onLog` ile canlı raporlanır. */
export async function veriHatalariniOnar(errors: AuditError[], onLog: (message: string) => void): Promise<void> {
 onLog(`Veritabanı Onarım İşlemi Başlatıldı...`);
 onLog(`Toplam Hata Sayısı: ${errors.length}`);

 // Temporary local object to collect schedule edits in memory to batch update documents properly
 const scheduleEdits: Record<string, HaftaPlan['gunler']> = {};
 // Tüm yazma/silme işlemleri önce burada toplanır, ardından Firestore'un
 // 500 işlemlik batch sınırını aşmamak için 400'lük parçalar halinde
 // commit edilir (bkz. telemetryService.errorLoglariniTemizle) — tek dev
 // bir batch, 500+ hata olduğunda commit'in komple başarısız olup hiçbir
 // kaydın onarılmamasına yol açardı.
 const operations: Array<{ ref: ReturnType<typeof doc>; type: 'update' | 'delete'; data?: UpdateData<DocumentData> }> = [];

 for (const err of errors) {
 if (!err.repairData) continue;

 const data = err.repairData;
 if (data.type === 'personnel_field') {
 onLog(`ONARILIYOR: Personel ${data.docId} için '${data.field}' alanı '${data.value}' yapılıyor.`);
 operations.push({ ref: doc(db, 'muezzins', data.docId), type: 'update', data: { [data.field]: data.value } });
 }
 else if (data.type === 'vacation_date') {
 onLog(`ONARILIYOR: İzin ${data.docId} için tarih düzeltmesi uygulanıyor.`);
 operations.push({ ref: doc(db, 'izinler', data.docId), type: 'update', data: { baslangic: data.start, bitis: data.end } });
 }
 else if (data.type === 'delete_doc') {
 onLog(`TEMİZLENİYOR: Yetim/Geçersiz belge (${data.collectionName}/${data.docId}) siliniyor.`);
 operations.push({ ref: doc(db, data.collectionName, data.docId), type: 'delete' });
 }
 else if (data.type === 'schedule_reset') {
 onLog(`DÜZELTİLİYOR: Plan ${data.planId} -> ${data.gun} -> ${data.vakit} -> ${data.field} sistem olarak sıfırlanıyor.`);
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

 onLog(`Değişiklikler Firebase Firestore veritabanına işleniyor...`);
 const CHUNK_SIZE = 400;
 for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
 const batch = writeBatch(db);
 operations.slice(i, i + CHUNK_SIZE).forEach((op) => {
 if (op.type === 'update') batch.update(op.ref, op.data!);
 else batch.delete(op.ref);
 });
 await batch.commit();
 }
 onLog(`Tebrikler! Tüm veri uyuşmazlıkları başarıyla giderildi ve onarıldı.`);
}
