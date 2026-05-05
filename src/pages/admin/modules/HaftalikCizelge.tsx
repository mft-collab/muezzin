import React, { useState } from 'react';
import { useHaftaPlan } from '../../../hooks/useHaftaPlan';
import { useMuezzinler } from '../../../hooks/admin/useMuezzinler';
import { db } from '../../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { format, addWeeks, subWeeks, startOfWeek, getISOWeek, getYear, parseISO, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../../components/ui/Modal';
import { Vakit, VakitAtama, HaftaPlanGun } from '../../../types';
import { AlertCircle, Users, Edit2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

const VAKITLER: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const getWeekString = (date: Date) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  return `W${format(weekStart, 'yyyy-MM-dd')}`;
};

export default function HaftalikCizelge() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const haftaId = getWeekString(currentDate);
  const { plan, loading } = useHaftaPlan(haftaId);
  const { muezzinler } = useMuezzinler();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ tarih: string, gunAdi: string, vakit: Vakit, data: VakitAtama } | null>(null);
  
  const [editFormData, setEditFormData] = useState({
    asil: '',
    yedek: ''
  });
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const handleMubahale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell || !plan) return;

    try {
      setErrorStatus(null);
      const gunKey = Object.keys(plan.gunler).find(k => k === editingCell.tarih);
      if (gunKey) {
        const updateObj: Record<string, any> = {};
        
        // Update ONLY the specific vakit
        updateObj[`gunler.${gunKey}.${editingCell.vakit}`] = { 
          asil: editFormData.asil, 
          yedek: editFormData.yedek 
        };

        await updateDoc(doc(db, 'haftaPlanlari', plan.id), updateObj);
        setModalOpen(false);
      }
    } catch (err) {
      setErrorStatus("Güncelleme sırasında bir hata oluştu.");
    }
  };

  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekLabel = `${haftaId} (${format(currentWeekStart, 'd MMMM', { locale: tr })})`;
  
  const openEdit = (tarih: string, gunAdi: string, vakit: Vakit, data: VakitAtama) => {
    setEditingCell({ tarih, gunAdi, vakit, data });
    setEditFormData({ asil: data.asil, yedek: data.yedek });
    setModalOpen(true);
  };

  const getMuezzinName = (uid: string) => {
    if (uid === 'SISTEM') return 'Sistem';
    return muezzinler.find(m => m.id === uid)?.displayName || 'Bilinmiyor';
  };

  return (
      <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 pb-8 border-b border-slate-200">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none lowercase italic">
            HİZMET<span className="text-indigo-600 italic">CETVELİ</span>
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-400 mt-3">OPERASYONEL HAFTALIK GÖREV DAĞILIM PLANI</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1 bg-slate-950/5 p-1 rounded-xl border border-slate-200 shadow-inner">
             <button 
               onClick={() => setCurrentDate(subWeeks(currentDate, 1))} 
               className="p-2.5 bg-white text-slate-900 rounded-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200"
             >
               <ChevronLeft size={14} />
             </button>
             <div className="px-6 py-1 text-center min-w-[140px]">
                <p className="text-sm font-bold text-slate-900 tracking-tight leading-none mb-1">
                   {format(currentWeekStart, 'd MMMM', { locale: tr }).toUpperCase()}
                </p>
                <p className="text-[9px] font-bold uppercase text-indigo-500 tracking-widest">HAFTA BAŞI</p>
             </div>
             <button 
               onClick={() => setCurrentDate(addWeeks(currentDate, 1))} 
               className="p-2.5 bg-white text-slate-900 rounded-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200"
             >
               <ChevronRight size={14} />
             </button>
           </div>
        </div>
      </header>

      {!plan && !loading && (
        <div className="bg-slate-100 p-16 rounded-[40px] text-center border border-slate-200 flex flex-col items-center max-w-xl mx-auto shadow-inner">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-6 border border-slate-200">
             <AlertCircle size={32} />
          </div>
          <p className="font-bold text-xl text-slate-900 tracking-tight uppercase">ÇİZELGE HAZIRLIK AŞAMASINDA</p>
          <p className="text-[10px] mt-4 text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
            Seçilen tarih aralığı için henüz bir hizmet planlaması gerçekleştirilmemiş.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-600 shadow-sm"></div>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">CETVEL VERİLERİ YÜKLENİYOR</p>
          </div>
        </div>
      )}

      {plan && (
        <div className="space-y-4">
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25, delay: idx * 0.03 }}
                  className={`flex flex-col sm:flex-row items-start sm:items-center p-3 sm:p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden gap-4 sm:gap-6 ${
                    isToday 
                    ? 'bg-indigo-600 border-indigo-500 shadow-md text-white' 
                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md hover:bg-slate-50 text-slate-800 shadow-sm'
                  }`}
                >
                  {/* Compact Date Section */}
                  <div className="flex items-center gap-4 min-w-[120px] shrink-0">
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${
                      isToday ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className="text-lg font-bold leading-none">{format(parsedDate, 'd')}</span>
                      <span className="text-[9px] uppercase font-semibold tracking-wider mt-0.5">{format(parsedDate, 'MMM', { locale: tr }).substring(0, 3)}</span>
                    </div>
                    <div>
                      <h4 className={`text-base font-medium tracking-tight ${
                        isToday ? 'text-white' : 'text-slate-800'
                      }`}>
                        {gunAdi}
                      </h4>
                      {isToday && (
                        <span className="text-[9px] uppercase font-bold tracking-widest text-indigo-200">
                          Bugün
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Minimal Divider */}
                  <div className={`hidden sm:block w-px h-10 ${
                    isToday ? 'bg-white/20' : 'bg-slate-200'
                  }`} />

                  {/* Vakit Edit Buttons Grid */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 w-full">
                    {VAKITLER.map(vakit => {
                      const atama = gunObj[vakit];
                      return (
                        <motion.button
                          key={vakit}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openEdit(tarih, gunAdi, vakit, atama)}
                          className={`flex flex-col justify-center p-2.5 rounded-xl border text-left transition-all relative group ${
                            isToday 
                              ? 'bg-white/10 border-white/10 hover:bg-white/20' 
                              : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50 shadow-sm'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1.5 opacity-60">
                            <span className="text-[9px] font-bold uppercase tracking-widest leading-none">
                              {vakit}
                            </span>
                            <Edit2 size={10} className="group-hover:opacity-100 opacity-0 transition-opacity" />
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[11px] font-semibold truncate leading-none">
                              {getMuezzinName(atama?.asil || '').split(' ').slice(-1)[0]}
                            </p>
                            <p className="text-[9px] truncate leading-none opacity-50">
                              {getMuezzinName(atama?.yedek || '').split(' ').slice(-1)[0] || '-'}
                            </p>
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

      {/* Manual Edit Modal - Minimalist */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="HİZMET MÜDAHALESİ">
        <form onSubmit={handleMubahale} className="space-y-8 p-2">
          <AnimatePresence mode="wait">
            {errorStatus && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-[10px] font-bold uppercase tracking-widest"
              >
                <AlertCircle size={14} />
                {errorStatus}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">SEÇİLEN OPERASYON PARAMETRESİ</p>
            <div className="flex items-center gap-3">
               <span className="text-lg font-black text-slate-900 tracking-tighter italic lowercase">{editingCell?.gunAdi}</span>
               <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
               <span className="text-sm font-bold text-indigo-600 uppercase tracking-widest">{editingCell?.vakit} VAKTİ</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">{editingCell?.tarih}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">ASİL GÖREVLİ</label>
              <div className="relative group">
                <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors" size={16} />
                <select 
                  value={editFormData.asil} 
                  onChange={e => setEditFormData({...editFormData, asil: e.target.value})} 
                  className="w-full border border-slate-200 bg-slate-50 p-5 pl-14 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer outline-none"
                >
                  <optgroup label="SİSTEM OTOMASYONU">
                    <option value="SISTEM">OTOMATİK (ZEKİ ATAMA)</option>
                  </optgroup>
                  <optgroup label="AKTİF KADRO LİSTESİ">
                    {muezzinler.filter(m => (m.aktif && m.role !== 'admin') || m.id === editingCell?.data?.asil).map(m => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">YEDEK PERSONEL</label>
              <div className="relative group">
                <Users className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors" size={16} />
                <select 
                  value={editFormData.yedek} 
                  onChange={e => setEditFormData({...editFormData, yedek: e.target.value})} 
                  className="w-full border border-slate-200 bg-slate-50 p-5 pl-14 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer outline-none"
                >
                  <optgroup label="SİSTEM OTOMASYONU">
                    <option value="SISTEM">OTOMATİK (ZEKİ ATAMA)</option>
                  </optgroup>
                  <optgroup label="AKTİF KADRO LİSTESİ">
                    {muezzinler.filter(m => (m.aktif && m.role !== 'admin') || m.id === editingCell?.data?.yedek).map(m => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row gap-4">
             <button type="submit" className="flex-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest py-5 px-4 rounded-2xl shadow-lg shadow-slate-950/20 hover:bg-indigo-600 transition-all">
               DEĞİŞİKLİKLERİ ONAYLA
             </button>
             <button type="button" onClick={() => setModalOpen(false)} className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-900 transition-all">
               VAZGEÇ
             </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
