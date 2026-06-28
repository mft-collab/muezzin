import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useHaftaPlan } from '../../../hooks/useHaftaPlan';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { useHaftaBildirimleri } from '../../../hooks/admin/useHaftaBildirimleri';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { db } from '../../../lib/firebase';
import { collection, doc, getDocs, query, Timestamp, where, writeBatch } from 'firebase/firestore';
import { haftalikPlanOlustur } from '../../../services/planServisi';
import { format, addWeeks, subWeeks, startOfWeek, parseISO, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../../components/ui/Modal';
import { Vakit, VakitAtama } from '../../../types';
import { AlertCircle, Edit2, ChevronLeft, ChevronRight, RotateCcw, Zap } from 'lucide-react';
import { telemetryService } from '../../../services/telemetryService';

const VAKITLER: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
const getWeekString = (date: Date) => {
 const weekStart = startOfWeek(date, { weekStartsOn: 1 });
 return `W${format(weekStart, 'yyyy-MM-dd')}`;
};
let globalHasAnimatedCizelge = false;

export default function HaftalikCizelge() {
 const shouldAnimate = React.useRef(!globalHasAnimatedCizelge).current;
 useEffect(() => {
 globalHasAnimatedCizelge = true;
 }, []);

 const [currentDate, setCurrentDate] = useState(new Date());
 const haftaId = getWeekString(currentDate);
 const { plan, loading: planLoading } = useHaftaPlan(haftaId);
 const muezzinler = useMuezzinStore(s => s.muezzinler);
 const muezzinMap = useMuezzinStore(s => s.muezzinMap);
 const { bildirimler: haftaBildirimleri, loading: bildirimLoading } = useHaftaBildirimleri(haftaId);
 const showNotification = useNotificationStore(s => s.showNotification);
 const isAdmin = useAuthStore(s => s.isAdmin);
 
 const loading = planLoading || bildirimLoading;
 
 const [modalOpen, setModalOpen] = useState(false);
 const [editingCell, setEditingCell] = useState<{ tarih: string, gunAdi: string, vakit: Vakit, data: VakitAtama } | null>(null);
 
 const [editFormData, setEditFormData] = useState({
 asil: '',
 yedek: ''
 });
 const [errorStatus, setErrorStatus] = useState<string | null>(null);
 const [generating, setGenerating] = useState(false);

 const isAssignableMuezzin = useCallback((uid: string) => {
 if (!uid || uid === 'Sistem' || uid === 'SISTEM') return true;
 const person = muezzinler.find((m) => m.id === uid);
 return !!person && person.aktif === true && person.role === 'muezzin';
 }, [muezzinler]);

  const handlePlanOlustur = async () => {
    try {
      setGenerating(true);
      setErrorStatus(null);
      await haftalikPlanOlustur(haftaId);
      showNotification('Plan Oluşturuldu', `${haftaId} haftası için plan başarıyla oluşturuldu.`, 'success');
      await telemetryService.logAudit('Otomatik Plan Oluşturma', haftaId, 'Haftalık görev planı otonom motor tarafından oluşturuldu.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Plan oluşturulurken bir hata oluştu.";
      setErrorStatus(errorMessage);
      showNotification('Hata', errorMessage, 'error');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!plan && !planLoading && isAdmin && haftaId && !generating) {
      console.log(`[Self-Healing] Cizelge sayfasında plan bulunamadı (${haftaId}). Otomatik oluşturma tetikleniyor...`);
      handlePlanOlustur();
    }
  }, [plan, planLoading, isAdmin, haftaId, generating]);

  const exportWeeklyPlanCSV = () => {
    if (!plan) return;
    const headers = ['Tarih', 'Gün', 'Vakit', 'Asil Görevli', 'Yedek Görevli'];
    const rows: string[][] = [];

    Object.keys(plan.gunler).sort().forEach(tarih => {
      const gunObj = plan.gunler[tarih];
      const gunAdi = format(parseISO(tarih), 'EEEE', { locale: tr });
      VAKITLER.forEach(vakit => {
        const atama = gunObj[vakit] || { asil: '', yedek: '' };
        rows.push([
          tarih,
          gunAdi,
          vakit.toUpperCase(),
          getMuezzinName(atama.asil),
          getMuezzinName(atama.yedek)
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `haftalik-nobet-plani-${plan.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    telemetryService.logAudit('Plan Çıktısı Alma', plan.id, 'Haftalık nöbet çizelgesi CSV formatında dışa aktarıldı.');
  };

 const handleMubahale = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!editingCell || !plan) return;
 if (
 editFormData.asil &&
 editFormData.yedek &&
 editFormData.asil !== 'Sistem' &&
 editFormData.asil === editFormData.yedek
 ) {
 setErrorStatus('Asil ve yedek görevli aynı kişi olamaz.');
 showNotification('Hata', 'Asil ve yedek görevli aynı kişi olamaz.', 'error');
 return;
 }
 if (!isAssignableMuezzin(editFormData.asil) || !isAssignableMuezzin(editFormData.yedek)) {
 setErrorStatus('Sadece aktif müezzinler görevlendirilebilir. Admin ve gözlemci atanamaz.');
 showNotification('Hata', 'Sadece aktif müezzinler görevlendirilebilir. Admin ve gözlemci atanamaz.', 'error');
 return;
 }

 try {
 setErrorStatus(null);
 const gunKey = Object.keys(plan.gunler).find(k => k === editingCell.tarih);
 if (gunKey) {
 const batch = writeBatch(db);
 const gunBildirimleriSnap = await getDocs(query(
 collection(db, 'bildirimler'),
 where('haftaId', '==', plan.id),
 where('tarih', '==', gunKey)
 ));

 const bildirimlerByVakit = VAKITLER.reduce((acc, vakit) => {
 acc[vakit] = gunBildirimleriSnap.docs.filter(d => d.data().vakit === vakit);
 return acc;
 }, {} as Record<Vakit, typeof gunBildirimleriSnap.docs>);

 const korunacakVakitler = VAKITLER.filter((vakit) =>
 bildirimlerByVakit[vakit].some((d) => {
 const data = d.data();
 return data.durum === 'onaylandi' || data.durum === 'reddedildi' || data.tip === 'gorev_cagrisi';
 })
 );
 const guncellenecekVakitler = VAKITLER.filter(v => !korunacakVakitler.includes(v));

 if (guncellenecekVakitler.length === 0) {
 const msg = 'Bu gün için tüm vakitlerde mazeret/onay geçmişi var. Güvenli güncelleme yapılamadı.';
 setErrorStatus(msg);
 showNotification('Güncelleme Engellendi', msg, 'warning');
 return;
 }

 guncellenecekVakitler.forEach((vakit) => {
 bildirimlerByVakit[vakit].forEach((bildirimDoc) => {
 batch.delete(bildirimDoc.ref);
 });

 batch.update(doc(db, 'haftaPlanlari', plan.id), {
 [`gunler.${gunKey}.${vakit}`]: {
 asil: editFormData.asil,
 yedek: editFormData.yedek
 }
 });

 if (editFormData.asil && editFormData.asil !== 'Sistem') {
 batch.set(doc(collection(db, 'bildirimler')), {
 haftaId: plan.id,
 tarih: gunKey,
 vakit,
 uid: editFormData.asil,
 tip: 'asil',
 durum: 'bekliyor',
 pendingAck: true,
 retSebebi: null,
 olusturmaTarihi: Timestamp.now(),
 sonGuncelleme: Timestamp.now()
 });
 }

 if (editFormData.yedek && editFormData.yedek !== 'Sistem') {
 batch.set(doc(collection(db, 'bildirimler')), {
 haftaId: plan.id,
 tarih: gunKey,
 vakit,
 uid: editFormData.yedek,
 tip: 'yedek',
 durum: 'bekliyor',
 pendingAck: true,
 retSebebi: null,
 olusturmaTarihi: Timestamp.now(),
 sonGuncelleme: Timestamp.now()
 });
 }
 });

 await batch.commit();
 setModalOpen(false);
 if (korunacakVakitler.length > 0) {
 showNotification(
 'Kısmi Güncelleme',
 `Gün güncellendi. Mazeret/onay çakışması nedeniyle korunmuş vakitler: ${korunacakVakitler.join(', ')}`,
 'warning'
 );
 } else {
 showNotification('Güncelleme Başarılı', 'Seçili günün tüm vakitleri tek asil ve tek yedek olacak şekilde güncellendi.', 'success');
 }
 await telemetryService.logAudit('Manuel Görev Atama', editingCell.tarih, `${editingCell.vakit.toUpperCase()} vakti için asil: ${getMuezzinName(editFormData.asil)}, yedek: ${getMuezzinName(editFormData.yedek)} ataması yapıldı.`);
 }
 } catch (err) {
 setErrorStatus("Güncelleme sırasında bir hata oluştu.");
 showNotification('Hata', 'Güncelleme sırasında bir hata oluştu.', 'error');
 }
 };

 const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
 
 const openEdit = useCallback((tarih: string, gunAdi: string, vakit: Vakit, data: VakitAtama) => {
 setEditingCell({ tarih, gunAdi, vakit, data });
 setEditFormData({ asil: data.asil, yedek: data.yedek });
 setModalOpen(true);
 }, []);

 const getMuezzinName = useCallback((uid: string) => {
 if (!uid) return 'Bilinmiyor';
 if (uid === 'Sistem' || uid === 'SISTEM') return 'Sistem';
 const person = muezzinMap[uid];
 if (!person) return 'Bilinmiyor';
 if (person.role !== 'muezzin' || person.aktif !== true) return 'Geçersiz Atama';
 return person.displayName || 'Bilinmiyor';
 }, [muezzinMap]);

 const getStatusColor = (durum: string | undefined) => {
 if (durum === 'onaylandi') return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]';
 if (durum === 'reddedildi') return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]';
 return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'; // bekliyor
 };

 const renderedGrid = useMemo(() => {
    if (!plan) return null;
    return (
      <div className="flex flex-col gap-3 lg:gap-4">
        <AnimatePresence mode="popLayout">
          {Object.keys(plan.gunler).sort().map((tarih, idx) => {
            const gunObj = plan.gunler[tarih];
            const isToday = isSameDay(parseISO(tarih), new Date());
            const gunAdi = format(parseISO(tarih), 'EEEE', { locale: tr });
            const parsedDate = parseISO(tarih);
            
            return (
              <motion.div 
                key={tarih}
                layout
                initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldAnimate ? { type: "spring", stiffness: 400, damping: 30, delay: idx * 0.05 } : { duration: 0.2 }}
                className={`flex flex-col lg:flex-row items-stretch lg:items-center p-3 sm:p-4 gap-4 sm:gap-6 rounded-[24px] sm:rounded-[28px] lg:rounded-[32px] border transition-all duration-700 relative overflow-hidden ${
                  isToday 
                    ? 'bg-[var(--dynamic-aura,var(--aura-indigo))]/5 border-[var(--dynamic-aura,var(--aura-indigo))]/20 shadow-[var(--spatial-shadow)]' 
                    : 'spatial-glass border-white/5 hover:bg-white/[0.02]'
                }`}
              >
                {isToday && (
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-[var(--dynamic-aura,var(--aura-indigo))]/40 shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                )}

                {/* Date Identity */}
                <div className="flex items-center gap-4 sm:gap-5 min-w-[150px] shrink-0 pl-1 sm:pl-2">
                  <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-[22px] border ${
                    isToday ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-white border-[var(--dynamic-aura,var(--aura-indigo))] shadow-lg' : 'bg-white/[0.03] text-[var(--dynamic-aura,var(--aura-indigo))]/60 border-white/5'
                  }`}>
                    <span className="text-2xl font-light tracking-tighter leading-none">{format(parsedDate, 'd')}</span>
                    <span className="text-[6px] font-bold uppercase tracking-wide mt-1 opacity-60">{format(parsedDate, 'MMM')}</span>
                  </div>
                  <div>
                    <h4 className={`text-lg font-light tracking-tight ${isToday ? 'text-[var(--dynamic-aura,var(--aura-indigo))]' : 'text-[var(--text-primary)]'}`}>
                      {gunAdi}
                    </h4>
                    <p className="authority-title !text-[6px] opacity-20 uppercase tracking-wide mt-1">{format(parsedDate, 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                {/* Vakit Slots Grid */}
                <div className="flex-1 grid grid-cols-1 min-[370px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 w-full">
                  {VAKITLER.map(vakit => {
                    const atama = gunObj[vakit];
                    const asilBildirim = haftaBildirimleri.find(b => b.tarih === tarih && b.vakit === vakit && b.uid === atama?.asil);
                    
                    return (
                      <motion.button
                        key={vakit}
                        whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.05)', zIndex: 50 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => openEdit(tarih, gunAdi, vakit, atama)}
                        className="spatial-glass-elevated p-3 sm:p-4 rounded-[18px] sm:rounded-[24px] text-left border border-white/5 transition-all duration-500 group relative min-h-[84px]"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="authority-title !text-[6px] opacity-40 uppercase tracking-wide font-bold text-[var(--dynamic-aura,var(--aura-indigo))]">
                            {vakit}
                          </span>
                          <Edit2 size={12} strokeWidth={1.5} className="group-hover:opacity-100 opacity-0 transition-all text-white/20" />
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(asilBildirim?.durum)}`} />
                            <span className="text-xs font-medium text-[var(--text-primary)] tracking-tight truncate">
                              {getMuezzinName(atama?.asil || '').split(' ').slice(-1)[0] || '—'}
                            </span>
                          </div>

                          {atama?.yedek && (
                            <div className="flex items-center gap-3 opacity-30">
                              <div className="w-1 h-1 rounded-full bg-white/40" />
                              <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wide truncate">
                                {getMuezzinName(atama?.yedek || '').split(' ').slice(-1)[0]}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }, [plan, haftaBildirimleri, openEdit, getMuezzinName, currentDate]);

 return (
 <div className="flex flex-col gap-6 lg:gap-10">
 {/* TOOLBAR: Chronos Navigation */}
 <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-6">
 <div className="flex flex-col gap-1.5">
 <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Hizmet Cetveli</h2>
 <p className="authority-title !text-[7px] opacity-30 font-medium tracking-wide">OPERASYONEL GÖREV DAĞILIMI VE PLANLAMA</p>
 </div>

 <div className="flex items-center gap-2 sm:gap-4 bg-white/[0.02] p-2 rounded-[20px] sm:rounded-[24px] border border-white/5 shadow-[var(--spatial-shadow)] w-full lg:w-auto justify-between">
 <motion.button 
 whileHover={{ scale: 1.1 }}
 whileTap={{ scale: 0.9 }}
 onClick={() => setCurrentDate(subWeeks(currentDate, 1))} 
 className="w-12 h-12 flex items-center justify-center bg-white/[0.03] text-[var(--text-secondary)] rounded-2xl hover:text-[var(--dynamic-aura,var(--aura-indigo))] border border-white/5 transition-all shadow-lg"
 >
 <ChevronLeft size={20} />
 </motion.button>
 
 <div className="px-2 sm:px-6 text-center flex flex-col items-center min-w-0">
 <span className="text-xs sm:text-sm font-light text-[var(--text-primary)] tracking-tight truncate max-w-[170px] sm:max-w-none">
 {format(currentWeekStart, 'd MMMM yyyy', { locale: tr })}
 </span>
 <span className="authority-title !text-[6px] opacity-40 mt-1 uppercase tracking-wide">PLANLAMA HAFTASI</span>
 </div>

 <motion.button 
 whileHover={{ scale: 1.1 }}
 whileTap={{ scale: 0.9 }}
 onClick={() => setCurrentDate(addWeeks(currentDate, 1))} 
 className="w-12 h-12 flex items-center justify-center bg-white/[0.03] text-[var(--text-secondary)] rounded-2xl hover:text-[var(--dynamic-aura,var(--aura-indigo))] border border-white/5 transition-all shadow-lg"
 >
 <ChevronRight size={20} />
 </motion.button>
 </div>

  <div className="flex flex-col lg:flex-row items-center gap-3 w-full lg:w-auto">
    <motion.button 
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={exportWeeklyPlanCSV}
      disabled={!plan || loading}
      className="bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] border border-[var(--dynamic-aura,var(--aura-indigo))]/20 px-5 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-[9px] font-bold uppercase tracking-wide shadow-lg flex items-center justify-center gap-3 sm:gap-4 disabled:opacity-30 group w-full lg:w-auto cursor-pointer"
    >
      <Zap size={16} className="group-hover:scale-110 transition-transform duration-500" />
      ÇİZELGEYİ AKTAR
    </motion.button>
    
    <motion.button 
      whileHover={{ y: -3, scale: 1.02, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
      whileTap={{ scale: 0.98 }}
      onClick={handlePlanOlustur}
      disabled={generating}
      className="bg-[var(--dynamic-aura,var(--aura-indigo))] text-white px-5 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-[9px] font-bold uppercase tracking-wide shadow-lg flex items-center justify-center gap-3 sm:gap-4 disabled:opacity-50 group w-full lg:w-auto cursor-pointer"
    >
      <RotateCcw size={16} className={`group-hover:rotate-180 transition-transform duration-700 ${generating ? 'animate-spin' : ''}`} />
      {generating ? 'YENİLENİYOR...' : 'PLANLARI GÜNCELLE'}
    </motion.button>
  </div>
 </div>

 {/* MAIN CONTENT: Weekly Flow */}
 <div className="relative">
 {!plan && !loading && (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="spatial-glass p-16 rounded-[48px] text-center flex flex-col items-center max-w-2xl mx-auto border-dashed border-white/10"
 >
 <div className="w-20 h-20 bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] rounded-[28px] flex items-center justify-center mb-8 shadow-[var(--spatial-shadow)] border border-[var(--dynamic-aura,var(--aura-indigo))]/20">
 <AlertCircle size={36} strokeWidth={1.2} />
 </div>
 <h3 className="text-3xl font-light text-[var(--text-primary)] tracking-tight mb-4">Planlama Bulunamadı</h3>
 <p className="authority-title !text-[8px] opacity-40 uppercase tracking-wide leading-relaxed mb-12 max-w-sm">
 SEÇİLEN HAFTA İÇİN HENÜZ BİR OPERASYONEL CETVEL OLUŞTURULMADI. OTOMATİK PLANLAMA MOTORUNU ÇALIŞTIRABİLİRSİNİZ.
 </p>
 
 <motion.button
 whileHover={{ y: -5, scale: 1.05 }}
 whileTap={{ scale: 0.95 }}
 onClick={handlePlanOlustur}
 disabled={generating}
 className="bg-white text-black px-12 py-6 rounded-[24px] text-[10px] font-bold uppercase tracking-wide shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center gap-6"
 >
 <Zap size={18} className="text-amber-500 fill-amber-500" />
 SİSTEMİ ŞİMDİ PLANLA
 </motion.button>
 </motion.div>
 )}

  {loading && !plan && (
  <motion.div 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="flex flex-col gap-3 lg:gap-4"
  >
  {Array.from({ length: 3 }).map((_, i) => (
  <div key={i} className="flex flex-col lg:flex-row items-stretch lg:items-center p-3 sm:p-4 gap-4 sm:gap-6 rounded-[24px] sm:rounded-[28px] lg:rounded-[32px] border spatial-glass border-white/5 opacity-50">
  <div className="flex items-center gap-4 sm:gap-5 min-w-[150px] shrink-0 pl-1 sm:pl-2">
  <div className="w-14 h-14 rounded-[22px] bg-white/5 animate-pulse" />
  <div className="flex flex-col gap-2">
  <div className="w-20 h-4 bg-white/5 rounded-full animate-pulse" />
  <div className="w-16 h-2 bg-white/5 rounded-full animate-pulse" />
  </div>
  </div>
  <div className="flex-1 grid grid-cols-1 min-[370px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 w-full">
  {Array.from({ length: 5 }).map((_, j) => (
  <div key={j} className="spatial-glass-elevated p-3 sm:p-4 rounded-[18px] sm:rounded-[24px] border border-white/5 min-h-[84px] animate-pulse bg-white/[0.02]" />
  ))}
  </div>
  </div>
  ))}
  </motion.div>
  )}

 {plan && renderedGrid}
 </div>

  <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="HİZMET OPERASYONU">
    <form onSubmit={handleMubahale} className="space-y-10 py-4">
      <div className="spatial-glass-elevated p-4 sm:p-6 rounded-[24px] sm:rounded-[28px] border border-[var(--dynamic-aura,var(--aura-indigo))]/15 relative overflow-hidden bg-[var(--dynamic-aura,var(--aura-indigo))]/[0.02]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--dynamic-aura,var(--aura-indigo))]/5 blur-3xl rounded-full" />
        <p className="authority-title !text-[7px] opacity-30 mb-3 tracking-wide">SEÇİLİ VAKİT VE TARİH</p>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <span className="text-xl sm:text-2xl font-light text-[var(--text-primary)] tracking-tighter">{editingCell?.gunAdi}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_10px_var(--dynamic-aura,var(--aura-indigo))]" />
          <span className="text-sm font-bold text-[var(--dynamic-aura,var(--aura-indigo))] uppercase tracking-wide">{editingCell?.vakit}</span>
        </div>
        <p className="text-[10px] text-[var(--text-secondary)]/40 mt-2 font-medium tracking-wide">{editingCell?.tarih}</p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="space-y-4">
          <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-wide">ASİL GÖREVLİ ATAMASI</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setEditFormData({ ...editFormData, asil: 'Sistem' })}
              className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                editFormData.asil === 'Sistem'
                  ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-white border-[var(--dynamic-aura,var(--aura-indigo))]/60 shadow-[0_10px_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_25%,transparent)]'
                  : 'bg-white/[0.02] text-white/40 border-white/5 hover:border-white/10'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[10px] ${
                editFormData.asil === 'Sistem' ? 'bg-white/20' : 'bg-white/5 text-white/50'
              }`}>
                🤖
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider block">Sistem Otomatik</span>
                <span className="text-[7px] opacity-60 block leading-tight">Otomatik Planla</span>
              </div>
            </button>
            {muezzinler.filter(m => m.aktif && m.role === 'muezzin').map((m) => {
              const isSelected = editFormData.asil === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, asil: m.id })}
                  className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                    isSelected
                      ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-white border-[var(--dynamic-aura,var(--aura-indigo))]/60 shadow-[0_10px_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_25%,transparent)]'
                      : 'bg-white/[0.02] text-white/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isSelected ? 'bg-white/20' : 'bg-white/5 text-white/50'
                  }`}>
                    {(m.displayName || 'M').charAt(0)}
                  </div>
                  <div className="text-left truncate">
                    <span className="text-[10px] font-black uppercase tracking-wider block truncate">{(m.displayName || '').split(' ').slice(-1)[0]}</span>
                    <span className="text-[7px] opacity-60 block leading-tight">Görevli Kadro</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 mt-2">
          <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-wide">YEDEK PERSONEL ATAMASI</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setEditFormData({ ...editFormData, yedek: 'Sistem' })}
              className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                editFormData.yedek === 'Sistem'
                  ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-white border-[var(--dynamic-aura,var(--aura-indigo))]/60 shadow-[0_10px_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_25%,transparent)]'
                  : 'bg-white/[0.02] text-white/40 border-white/5 hover:border-white/10'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[10px] ${
                editFormData.yedek === 'Sistem' ? 'bg-white/20' : 'bg-white/5 text-white/50'
              }`}>
                🤖
              </div>
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider block">Sistem Otomatik</span>
                <span className="text-[7px] opacity-60 block leading-tight">Yedek Planla</span>
              </div>
            </button>
            {muezzinler.filter(m => m.aktif && m.role === 'muezzin').map((m) => {
              const isSelected = editFormData.yedek === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, yedek: m.id })}
                  className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                    isSelected
                      ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-white border-[var(--dynamic-aura,var(--aura-indigo))]/60 shadow-[0_10px_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_25%,transparent)]'
                      : 'bg-white/[0.02] text-white/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isSelected ? 'bg-white/20' : 'bg-white/5 text-white/50'
                  }`}>
                    {(m.displayName || 'M').charAt(0)}
                  </div>
                  <div className="text-left truncate">
                    <span className="text-[10px] font-black uppercase tracking-wider block truncate">{(m.displayName || '').split(' ').slice(-1)[0]}</span>
                    <span className="text-[7px] opacity-60 block leading-tight">Yedek Görevli</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-6 sm:pt-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6">
        <motion.button 
          whileHover={{ y: -3, scale: 1.01, boxShadow: '0 15px 30px color-mix(in srgb, var(--dynamic-aura, var(--aura-indigo)) 20%, transparent)' }}
          whileTap={{ scale: 0.98 }}
          type="submit" 
          className="flex-1 bg-[var(--dynamic-aura,var(--aura-indigo))] text-white text-[10px] font-bold uppercase tracking-wide py-4 sm:py-5 rounded-2xl shadow-lg shadow-[var(--dynamic-aura,var(--aura-indigo))]/15 transition-all"
        >
          ATAMAYI GÜNCELLE
        </motion.button>
        <motion.button 
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          type="button" 
          onClick={() => setModalOpen(false)} 
          className="px-6 sm:px-10 py-3.5 sm:py-5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all border border-white/5 rounded-2xl"
        >
          İPTAL
        </motion.button>
      </div>
    </form>
  </Modal>
  </div>
 );
}
