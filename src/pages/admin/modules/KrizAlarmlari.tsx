import React from 'react';
import { useKrizAlarmlari } from '../../../hooks/admin/useKrizAlarmlari';
import { db } from '../../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { AlertTriangle, ServerCrash, CalendarX, CheckCircle, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { VAKIT_GORA_ISIMLERI, toTurkishUpperCase } from '../../../lib/dateUtils';
import { Vakit, AdminUyarisi } from '../../../types';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { kriziBaslat } from '../../../services/mazeretServisi';

export default function KrizAlarmlari() {
  const { alarmlar, loading } = useKrizAlarmlari();
  const [showResolved, setShowResolved] = React.useState(false);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);
  const [confirmData, setConfirmData] = React.useState<{ open: boolean, alarm: (AdminUyarisi & { id: string }) | null }>({ open: false, alarm: null });
  const [isRetrying, setIsRetrying] = React.useState<string | null>(null);

  const handleResolveRequest = (alarm: AdminUyarisi & { id: string }) => {
    setConfirmData({ open: true, alarm });
  };

  const executeResolve = async () => {
    const alarm = confirmData.alarm;
    if (!alarm) return;
    
    setResolvingId(alarm.id);
    setConfirmData({ open: false, alarm: null });
    
    try {
      await updateDoc(doc(db, 'adminUyarilari', alarm.id), { 
        cozuldu: true,
        cozulmeTarihi: new Date()
      });
    } catch (err) {
      console.error("Vaka giderme hatası:", err);
      alert("Hata oluştu. Yetkiniz olmayabilir veya bağlantı sorunu yaşıyor olabilirsiniz.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleRetry = async (alarm: AdminUyarisi & { id: string }) => {
    if (!alarm.tarih || !alarm.vakit) return;
    setIsRetrying(alarm.id);
    try {
      // Re-trigger the crisis handler to find a new candidate
      const success = await kriziBaslat(alarm.tarih, alarm.vakit, []);
      if (success) {
        // Automatically resolve the alarm if we found a new candidate
        await updateDoc(doc(db, 'adminUyarilari', alarm.id), { 
          cozuldu: true,
          cozulmeTarihi: new Date()
        });
        alert("Başarılı: Yeni aday atandı ve vaka otomatik olarak arşivlendi.");
      } else {
        alert("Bilgi: Sistemde hâlâ uygun aday bulunamadı. Lütfen manuel müdahale edin.");
      }
    } catch (err) {
      console.error("Retry error:", err);
      alert("Algoritma çalıştırılırken hata oluştu.");
    } finally {
      setIsRetrying(null);
    }
  };

  const getIcon = (tip: string) => {
    switch (tip) {
      case 'zincirTukendi': return <AlertTriangle className="text-red-500" size={20} />;
      case 'apiHatasi': return <ServerCrash className="text-orange-500" size={20} />;
      case 'planOlusturulamadi': return <CalendarX className="text-orange-500" size={20} />;
      default: return <AlertTriangle size={20} />;
    }
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-rose-600"></div>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">ALARM VERİLERİ ÇEKİLİYOR</p>
      </div>
    </div>
  );

  const filteredAlarmlar = showResolved ? alarmlar : alarmlar.filter(a => !a.cozuldu);

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 pb-8 border-b border-rose-100">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none lowercase italic text-left">
            OPERASYONEL<span className="text-rose-600 italic">VAKALAR</span>
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-400 mt-3">GERÇEK ZAMANLI KRİTİK MÜDAHALE BİRİMİ</p>
        </div>
        
        <label className="flex items-center gap-4 select-none cursor-pointer group bg-slate-50 p-2 px-4 rounded-2xl border border-slate-200 shadow-inner transition-all hover:bg-white text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <div className={`w-9 h-5 rounded-full transition-all relative shadow-inner ${showResolved ? 'bg-indigo-600' : 'bg-slate-300'}`}>
             <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${showResolved ? 'left-5' : 'left-1'}`} />
          </div>
          <input type="checkbox" className="hidden" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          <span>ARŞİV GÖRÜNÜMÜ</span>
        </label>
      </header>

      {filteredAlarmlar.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-600 text-white p-16 rounded-[40px] text-center border border-emerald-500 flex flex-col items-center shadow-xl shadow-emerald-900/10"
        >
          <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white mb-8 border border-white/20">
            <CheckCircle size={40} />
          </div>
          <p className="font-black text-2xl tracking-tighter uppercase italic">SİSTEM GÜVENDE</p>
          <p className="text-[10px] mt-4 text-emerald-100 font-bold uppercase tracking-[0.3em] leading-relaxed">
            ŞU ANDA AKTİF BİR KRİZ ALARMI TESPİT EDİLMEDİ.
          </p>
        </motion.div>
      )}

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredAlarmlar.map((alarm, idx) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: idx * 0.05 }}
              key={alarm.id} 
              className={`relative overflow-hidden p-6 rounded-2xl border transition-all ${
                alarm.cozuldu 
                  ? 'bg-slate-50 border-slate-100 opacity-60' 
                  : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              {!alarm.cozuldu && (
                 <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
              )}
              
              <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    alarm.cozuldu ? 'bg-slate-100 text-slate-300 border-slate-200' : 'bg-slate-900 text-white border-slate-800'
                  }`}>
                    {React.cloneElement(getIcon(alarm.tip) as React.ReactElement, { size: 16 })}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                       <h3 className={`text-sm font-bold tracking-tight uppercase ${alarm.cozuldu ? 'text-slate-400' : 'text-slate-900'}`}>
                         {alarm.tip === 'zincirTukendi' ? 'Veri Zinciri Kesintisi' : 
                          alarm.tip === 'apiHatasi' ? 'Harici API Arızası' : 
                          alarm.tip === 'planOlusturulamadi' ? 'Zekâ Planlama Sapması' : 'Sistem Çizelge Sapması'}
                       </h3>
                       <div className={`h-1.5 w-1.5 rounded-full ${alarm.cozuldu ? 'bg-slate-300' : 'bg-rose-500 animate-pulse'}`} />
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <p className={`text-[8px] font-bold uppercase tracking-widest ${alarm.cozuldu ? 'text-slate-300' : 'text-slate-400'}`}>
                        {alarm.tarih ? format(new Date(alarm.tarih), 'dd/MM/yyyy', { locale: tr }) : '--'}
                        {alarm.vakit ? ` • ${VAKIT_GORA_ISIMLERI[alarm.vakit as Vakit]}` : ''}
                      </p>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <span className={`text-[8px] font-bold uppercase tracking-widest ${alarm.cozuldu ? 'text-slate-300' : 'text-rose-500'}`}>
                        {alarm.cozuldu ? 'ARŞİVLENDİ' : 'ACİL MÜDAHALE BEKLİYOR'}
                      </span>
                    </div>

                    <p className={`text-xs font-medium leading-relaxed max-w-xl ${alarm.cozuldu ? 'text-slate-400' : 'text-slate-600'}`}>
                      {alarm.mesaj}
                    </p>
                  </div>
                </div>
                
                {!alarm.cozuldu && (
                  <div className="flex flex-col gap-2 shrink-0 md:min-w-[140px]">
                    {alarm.tip === 'zincirTukendi' && (
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isRetrying === alarm.id}
                        onClick={() => handleRetry(alarm)}
                        className="text-[8px] font-bold uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <RefreshCcw size={12} className={isRetrying === alarm.id ? 'animate-spin' : ''} />
                        OTOMATİK ONAR
                      </motion.button>
                    )}
                    
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={resolvingId === alarm.id}
                      onClick={() => handleResolveRequest(alarm)}
                      className="text-[8px] font-bold uppercase tracking-widest bg-white text-slate-900 hover:bg-slate-50 px-4 py-2.5 rounded-lg transition-all border border-slate-200 shadow-sm"
                    >
                      MANUEL ARŞİVLE
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <ConfirmModal 
        isOpen={confirmData.open}
        onClose={() => setConfirmData({ open: false, alarm: null })}
        onConfirm={executeResolve}
        title="Vakayı Çözüldü Olarak İşaretle"
        message={confirmData.alarm ? `${confirmData.alarm.tip === 'zincirTukendi' ? 'Veri Zinciri Tükendi' : 'Sistem Kritik Uyarısı'} başlıklı vakayı arşivlemek üzeresiniz. Lütfen gerekli önlemlerin alındığından emin olun.` : ''}
        confirmText="Evet, Arşivle"
        isDanger={false}
      />
    </div>
  );
}
