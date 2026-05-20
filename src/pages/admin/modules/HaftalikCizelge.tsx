import React, { useState, useCallback, useMemo } from 'react';
import { useHaftaPlan } from '../../../hooks/useHaftaPlan';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { useHaftaBildirimleri } from '../../../hooks/admin/useHaftaBildirimleri';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { db } from '../../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { haftalikPlanOlustur } from '../../../services/planServisi';
import { format, addWeeks, subWeeks, startOfWeek, getISOWeek, getYear, parseISO, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../../components/ui/Modal';
import { Vakit, VakitAtama, HaftaPlanGun } from '../../../types';
import { AlertCircle, Users, Edit2, ChevronLeft, ChevronRight, RotateCcw, Zap } from 'lucide-react';

const VAKITLER: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const getWeekString = (date: Date) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  return `W${format(weekStart, 'yyyy-MM-dd')}`;
};

export default function HaftalikCizelge() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const haftaId = getWeekString(currentDate);
  const { plan, loading: planLoading } = useHaftaPlan(haftaId);
  const muezzinler = useMuezzinStore(s => s.muezzinler);
  const muezzinMap = useMuezzinStore(s => s.muezzinMap);
  const { bildirimler: haftaBildirimleri, loading: bildirimLoading } = useHaftaBildirimleri(haftaId);
  const showNotification = useNotificationStore(s => s.showNotification);
  
  const loading = planLoading || bildirimLoading;
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ tarih: string, gunAdi: string, vakit: Vakit, data: VakitAtama } | null>(null);
  
  const [editFormData, setEditFormData] = useState({
    asil: '',
    yedek: ''
  });
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handlePlanOlustur = async () => {
    try {
      setGenerating(true);
      setErrorStatus(null);
      await haftalikPlanOlustur(haftaId);
      showNotification('Plan Oluşturuldu', `${haftaId} haftası için plan başarıyla oluşturuldu.`, 'success');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Plan oluşturulurken bir hata oluştu.";
      setErrorStatus(errorMessage);
      showNotification('Hata', errorMessage, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleMubahale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell || !plan) return;

    try {
      setErrorStatus(null);
      const gunKey = Object.keys(plan.gunler).find(k => k === editingCell.tarih);
      if (gunKey) {
        // Sadece seçilen vakti güncelle — diğer vakitler dokunulmasın
        await updateDoc(doc(db, 'haftaPlanlari', plan.id), {
          [`gunler.${gunKey}.${editingCell.vakit}`]: {
            asil: editFormData.asil,
            yedek: editFormData.yedek
          }
        });
        setModalOpen(false);
        showNotification('Güncelleme Başarılı', 'Görev ataması başarıyla değiştirildi.', 'success');
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
    return muezzinMap[uid]?.displayName || 'Bilinmiyor';
  }, [muezzinMap]);

  const getStatusColor = (durum: string | undefined) => {
    if (durum === 'onaylandi') return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]';
    if (durum === 'reddedildi') return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]';
    return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'; // bekliyor
  };

  return (
    <div className="flex flex-col gap-10">
      {/* TOOLBAR: Chronos Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Hizmet Cetveli</h2>
           <p className="authority-title !text-[7px] opacity-30 font-medium tracking-[0.2em]">OPERASYONEL GÖREV DAĞILIMI VE PLANLAMA</p>
        </div>

        <div className="flex items-center gap-4 bg-white/[0.02] p-2 rounded-[24px] border border-white/5 shadow-2xl">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))} 
            className="w-12 h-12 flex items-center justify-center bg-white/[0.03] text-[var(--text-secondary)] rounded-2xl hover:text-indigo-400 border border-white/5 transition-all shadow-lg"
          >
            <ChevronLeft size={20} />
          </motion.button>
          
          <div className="px-10 text-center flex flex-col items-center">
             <span className="text-sm font-light text-[var(--text-primary)] tracking-tight">
                {format(currentWeekStart, 'd MMMM yyyy', { locale: tr })}
             </span>
             <span className="authority-title !text-[6px] opacity-40 mt-1 uppercase tracking-[0.3em]">PLANLAMA HAFTASI</span>
          </div>

          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))} 
            className="w-12 h-12 flex items-center justify-center bg-white/[0.03] text-[var(--text-secondary)] rounded-2xl hover:text-indigo-400 border border-white/5 transition-all shadow-lg"
          >
            <ChevronRight size={20} />
          </motion.button>
        </div>

        <motion.button 
          whileHover={{ y: -3, scale: 1.02, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePlanOlustur}
          disabled={generating}
          className="bg-indigo-500 text-white px-8 py-4 rounded-2xl text-[9px] font-bold uppercase tracking-[0.3em] shadow-lg flex items-center gap-4 disabled:opacity-50 group"
        >
          <RotateCcw size={16} className={`group-hover:rotate-180 transition-transform duration-700 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'YENİLENİYOR...' : 'PLANLARI GÜNCELLE'}
        </motion.button>
      </div>

      {/* MAIN CONTENT: Weekly Flow */}
      <div className="relative">
        {!plan && !loading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="spatial-glass p-16 rounded-[48px] text-center flex flex-col items-center max-w-2xl mx-auto border-dashed border-white/10"
          >
            <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-[28px] flex items-center justify-center mb-8 shadow-2xl border border-indigo-500/20">
               <AlertCircle size={36} strokeWidth={1.2} />
            </div>
            <h3 className="text-3xl font-light text-[var(--text-primary)] tracking-tight mb-4">Planlama Bulunamadı</h3>
            <p className="authority-title !text-[8px] opacity-40 uppercase tracking-[0.3em] leading-relaxed mb-12 max-w-sm">
              SEÇİLEN HAFTA İÇİN HENÜZ BİR OPERASYONEL CETVEL OLUŞTURULMADI. OTOMATİK PLANLAMA MOTORUNU ÇALIŞTIRABİLİRSİNİZ.
            </p>
            
            <motion.button
              whileHover={{ y: -5, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePlanOlustur}
              disabled={generating}
              className="bg-white text-black px-12 py-6 rounded-[24px] text-[10px] font-bold uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] flex items-center gap-6"
            >
              <Zap size={18} className="text-amber-500 fill-amber-500" />
              SİSTEMİ ŞİMDİ PLANLA
            </motion.button>
          </motion.div>
        )}

        {loading && (
          <div className="flex h-[500px] items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="w-14 h-14 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-xl" />
              <p className="authority-title !text-[9px] opacity-20 tracking-[0.5em] uppercase">Vakit Verileri Senkronize Ediliyor</p>
            </div>
          </div>
        )}

        {plan && (
          <div className="flex flex-col gap-4">
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
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ type: "spring", stiffness: 400, damping: 30, delay: idx * 0.05 }}
                     className={`flex flex-col lg:flex-row items-stretch lg:items-center p-4 gap-6 rounded-[32px] border transition-all duration-700 relative overflow-hidden ${
                        isToday 
                        ? 'bg-indigo-500/5 border-indigo-500/20 shadow-2xl' 
                        : 'spatial-glass border-white/5 hover:bg-white/[0.02]'
                      }`}
                    >
                     {isToday && (
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                     )}

                     {/* Date Identity */}
                     <div className="flex items-center gap-5 min-w-[160px] shrink-0 pl-2">
                       <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-[22px] border ${
                         isToday ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg' : 'bg-white/[0.03] text-indigo-400/60 border-white/5'
                       }`}>
                         <span className="text-2xl font-light tracking-tighter leading-none">{format(parsedDate, 'd')}</span>
                         <span className="text-[6px] font-bold uppercase tracking-widest mt-1 opacity-60">{format(parsedDate, 'MMM')}</span>
                       </div>
                       <div>
                         <h4 className={`text-lg font-light tracking-tight ${isToday ? 'text-indigo-400' : 'text-[var(--text-primary)]'}`}>
                          {gunAdi}
                        </h4>
                        <p className="authority-title !text-[6px] opacity-20 uppercase tracking-[0.2em] mt-1">{format(parsedDate, 'dd/MM/yyyy')}</p>
                      </div>
                    </div>

                    {/* Vakit Slots Grid */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
                      {VAKITLER.map(vakit => {
                        const atama = gunObj[vakit];
                        const asilBildirim = haftaBildirimleri.find(b => b.tarih === tarih && b.vakit === vakit && b.uid === atama?.asil);
                        
                        return (
                           <motion.button
                             key={vakit}
                             whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.05)', zIndex: 50 }}
                             whileTap={{ scale: 0.98 }}
                             onClick={() => openEdit(tarih, gunAdi, vakit, atama)}
                             className="spatial-glass-elevated p-4 rounded-[24px] text-left border border-white/5 transition-all duration-500 group relative"
                           >
                             <div className="flex justify-between items-center mb-3">
                               <span className="authority-title !text-[6px] opacity-40 uppercase tracking-[0.3em] font-bold text-indigo-400">
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
                                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest truncate">
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
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="HİZMET OPERASYONU">
        <form onSubmit={handleMubahale} className="space-y-10 py-4">
          <div className="spatial-glass-elevated p-6 rounded-[28px] border border-indigo-500/10 relative overflow-hidden bg-indigo-500/[0.02]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
            <p className="authority-title !text-[7px] opacity-30 mb-3 tracking-[0.4em]">SEÇİLİ VAKİT VE TARİH</p>
            <div className="flex items-center gap-4">
               <span className="text-2xl font-light text-[var(--text-primary)] tracking-tighter">{editingCell?.gunAdi}</span>
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
               <span className="text-sm font-bold text-indigo-500 uppercase tracking-[0.3em]">{editingCell?.vakit}</span>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]/40 mt-2 font-medium tracking-widest">{editingCell?.tarih}</p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em]">ASİL GÖREVLİ ATAMASI</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, asil: 'Sistem' })}
                  className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                    editFormData.asil === 'Sistem'
                      ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_10px_20px_rgba(99,102,241,0.25)]'
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
                {muezzinler.filter(m => (m.aktif && m.role === 'muezzin') || m.id === editingCell?.data?.asil).map((m) => {
                  const isSelected = editFormData.asil === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, asil: m.id })}
                      className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                        isSelected
                          ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_10px_20px_rgba(99,102,241,0.25)]'
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
              <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em]">YEDEK PERSONEL ATAMASI</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, yedek: 'Sistem' })}
                  className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                    editFormData.yedek === 'Sistem'
                      ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_10px_20px_rgba(99,102,241,0.25)]'
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
                {muezzinler.filter(m => (m.aktif && m.role === 'muezzin') || m.id === editingCell?.data?.yedek).map((m) => {
                  const isSelected = editFormData.yedek === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, yedek: m.id })}
                      className={`p-4 rounded-2xl flex items-center gap-3 transition-all border outline-none ${
                        isSelected
                          ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_10px_20px_rgba(99,102,241,0.25)]'
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

          <div className="pt-8 flex items-center gap-6">
             <motion.button 
               whileHover={{ y: -3, scale: 1.01, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
               whileTap={{ scale: 0.98 }}
               type="submit" 
               className="flex-1 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-[0.3em] py-5 rounded-2xl shadow-lg transition-all"
             >
               ATAMAYI GÜNCELLE
             </motion.button>
             <motion.button 
               whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
               type="button" 
               onClick={() => setModalOpen(false)} 
               className="px-10 py-5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all border border-white/5 rounded-2xl"
             >
               İPTAL
             </motion.button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
