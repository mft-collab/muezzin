import React, { useState, useEffect } from 'react';
import { Bildirim, Vakit } from '../types';
import { okudumOnayla } from '../services/okudumServisi';
import { mazeretBildir } from '../services/mazeretServisi';
import { getTurkeyNow, parseVakitToDate, VAKIT_GORA_ISIMLERI, toTurkishUpperCase } from '../lib/dateUtils';
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const GorevKarti: React.FC<{ bildirim: Bildirim; saat: string }> = ({ bildirim, saat }) => {
  const [isAktif, setIsAktif] = useState(false);
  const [isMazeretModalOpen, setIsMazeretModalOpen] = useState(false);
  const [mazeretSebebi, setMazeretSebebi] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onay, setOnay] = useState(false);
  const [uiMessage, setUiMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Modal kapandığında state'i temizle
  useEffect(() => {
    if (!isMazeretModalOpen) {
      setMazeretSebebi("");
      setOnay(false);
    }
  }, [isMazeretModalOpen]);

  useEffect(() => {
    const checkAktif = () => {
      const ezanVakti = parseVakitToDate(bildirim.tarih, saat);
      setIsAktif(getTurkeyNow().getTime() >= ezanVakti.getTime());
    };
    
    checkAktif();
    const interval = setInterval(checkAktif, 1000); // UI tepkiselliği için 1 saniyelik kesin kontrol (Performans engeli aşıldı)
    return () => clearInterval(interval);
  }, [bildirim.tarih, saat]);

  const handleOkudum = async () => {
    setUiMessage(null);
    try {
      await okudumOnayla(bildirim.id as string);
      setUiMessage({ type: 'success', text: 'Başarıyla onaylandı.' });
    } catch (error: unknown) {
      if (error instanceof Error) {
        setUiMessage({ type: 'error', text: error.message });
      } else {
        setUiMessage({ type: 'error', text: 'Bilinmeyen bir hata oluştu.' });
      }
    }
  };

  const submitMazeret = async () => {
    if (!mazeretSebebi.trim()) {
      setUiMessage({ type: 'error', text: 'Lütfen mazeretinizi kısaca belirtin.' });
      return;
    }
    setUiMessage(null);
    setIsSubmitting(true);
    try {
      await mazeretBildir(bildirim.id as string, mazeretSebebi);
      setIsMazeretModalOpen(false);
      setUiMessage({ type: 'success', text: 'Mazeretiniz kaydedildi ve görev devredildi.' });
    } catch (error: unknown) {
      if (error instanceof Error) {
        setUiMessage({ type: 'error', text: error.message });
      } else {
        setUiMessage({ type: 'error', text: 'Mazeret kaydedilirken hata oluştu.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusConfig = () => {
    if (bildirim.durum === 'onaylandi') return { color: 'green', text: 'Görev Onaylandı', icon: CheckCircle2 };
    if (bildirim.durum === 'reddedildi') return { color: 'red', text: 'Mazeret Bildirildi', icon: AlertCircle };
    if (bildirim.tip === 'gorev_cagrisi') return { color: 'red', text: 'Acil Çağrı', icon: AlertCircle };
    return { color: 'blue', text: bildirim.tip === 'asil' ? 'Asil Görev' : 'Yedek Nöbet', icon: Info };
  };

  const config = getStatusConfig();

  return (
    <>
      <motion.div 
        whileHover={{ y: -4, scale: 1.01 }}
        className={`p-6 xs:p-8 mb-4 sm:mb-6 rounded-none sm:rounded-[40px] bg-white border-x-0 sm:border border-blue-50/50 shadow-[0_20px_50px_-20px_rgba(30,58,138,0.08)] transition-all relative overflow-hidden group ${
          bildirim.durum === 'onaylandi' ? 'bg-gradient-to-br from-white to-green-50/20' : ''
        }`}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
          <div className="flex items-center gap-4 xs:gap-6">
             <div className={`w-16 h-16 xs:w-20 xs:h-20 rounded-[28px] flex items-center justify-center shadow-2xl transition-all duration-700 group-hover:rotate-6 ${
                config.color === 'red' ? 'bg-red-50 text-red-600 shadow-red-200/50 border border-red-100' : 
                config.color === 'green' ? 'bg-emerald-50 text-emerald-600 shadow-emerald-200/50 border border-emerald-100' :
                'bg-blue-50 text-blue-900 shadow-blue-200/50 border border-blue-100'
             }`}>
                <config.icon size={28} strokeWidth={2} className="xs:size-8" />
             </div>
             <div>
                <div className="flex items-center gap-2 mb-2">
                   <div className={`w-2 h-2 rounded-full ${isAktif ? 'bg-emerald-500 animate-pulse' : 'bg-gray-200'}`} />
                   <p className="text-[10px] font-medium uppercase tracking-widest text-blue-900/30">BUGÜN • {toTurkishUpperCase(bildirim.vakit)} VAKTİ</p>
                </div>
                <h3 className="font-sans font-thin text-2xl xs:text-3xl text-blue-950 tracking-tighter leading-none mb-1">
                   {toTurkishUpperCase(VAKIT_GORA_ISIMLERI[bildirim.vakit])}
                </h3>
                <div className="flex items-center gap-2 mt-3">
                   <div className="px-3 py-1 bg-blue-50 rounded-full flex items-center gap-1.5 border border-blue-100">
                      <Clock size={12} strokeWidth={2} className="text-blue-900" />
                      <span className="text-[12px] font-mono font-medium text-blue-950">{saat}</span>
                   </div>
                </div>
             </div>
          </div>
          <div className={`px-5 py-2 rounded-2xl text-[10px] font-medium uppercase tracking-widest border border-current shadow-sm ${
             config.color === 'red' ? 'bg-red-50 border-red-100/30 text-red-600' :
             config.color === 'green' ? 'bg-emerald-50 border-emerald-100/30 text-emerald-600' :
             'bg-blue-50 border-blue-100/30 text-blue-900'
          }`}>
             {config.text}
          </div>
        </div>

        <AnimatePresence>
          {uiMessage && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`mb-6 overflow-hidden`}
            >
               <div className={`p-5 rounded-2xl text-[13px] font-medium border-2 leading-relaxed flex items-center gap-3 ${
                  uiMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
               }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${uiMessage.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                     {uiMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  </div>
                  {uiMessage.text}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Actions - Apple Style Buttons */}
        {bildirim.durum === 'bekliyor' && bildirim.id && (
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <motion.button 
              whileHover={isAktif ? { scale: 1.02 } : {}}
              whileTap={isAktif ? { scale: 0.98 } : {}}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={handleOkudum}
              disabled={!isAktif}
              className={`flex-1 w-full py-5 rounded-[24px] font-medium text-[11px] tracking-widest uppercase transition-all relative overflow-hidden group/btn shadow-[0_8px_30px_rgb(0,0,0,0.08)] ${
                isAktif 
                ? 'bg-blue-950/90 backdrop-blur-xl text-white hover:shadow-[0_20px_40px_rgb(30,58,138,0.2)]' 
                : 'bg-white/50 backdrop-blur-md text-gray-400 shadow-none cursor-not-allowed border border-gray-200/50'
              }`}
            >
              {isAktif ? (
                <>
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                   <span className="flex items-center justify-center gap-3 relative z-10">
                      {bildirim.tip === 'asil' ? 'GÖREV İCRASINI ONAYLA' : 'NÖBETİ DEVRE AL'} 
                      <ChevronRight size={18} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
                   </span>
                </>
              ) : (
                <span className="flex items-center justify-center gap-2">
                   <Clock size={16} strokeWidth={1.5} /> HİZMET SÜRESİ BEKLENİYOR
                </span>
              )}
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => setIsMazeretModalOpen(true)}
              className="flex-1 w-full py-5 rounded-[24px] font-medium text-[10px] tracking-widest uppercase transition-all text-red-500/80 bg-white/60 backdrop-blur-xl border border-red-100/50 hover:bg-red-50 hover:border-red-200 hover:shadow-[0_8px_30px_rgb(239,68,68,0.1)]"
            >
              MAZERET KAYDI OLUŞTUR
            </motion.button>
          </div>
        )}

        {bildirim.durum === 'onaylandi' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="w-full py-5 rounded-[28px] bg-emerald-50 text-emerald-700 font-medium text-center text-[12px] tracking-widest border border-emerald-100 flex flex-col sm:flex-row items-center justify-between px-6 gap-3 shadow-inner"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                 <CheckCircle2 size={12} strokeWidth={4} />
              </div>
              <span>SİSTEM TARAFINDAN TEYİT EDİLDİ</span>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMazeretModalOpen(true)}
              className="px-4 py-2 bg-white/50 text-red-600 border border-red-100 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 hover:border-red-200 transition-colors"
            >
              MAZERET BİLDİR
            </motion.button>
          </motion.div>
        )}

        {bildirim.durum === 'reddedildi' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="w-full py-5 rounded-[28px] bg-red-50 text-red-700 font-medium text-center text-[12px] tracking-widest border border-red-100 flex items-center justify-center gap-3 shadow-inner"
          >
            <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
               <AlertCircle size={12} strokeWidth={4} />
            </div>
            MAZERET NEDENİYLE GÖREV DEVRİ
          </motion.div>
        )}

        {/* Subtle background flair */}
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-50/30 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-100/40 transition-all duration-1000" />
      </motion.div>

      {/* Mazeret Modal (Custom Dialog) */}
      <AnimatePresence>
        {isMazeretModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMazeretModalOpen(false)}
              className="absolute inset-0 bg-blue-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="bg-white rounded-[56px] w-full max-w-sm p-10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] relative z-10 border border-white/20"
            >
              <div className="flex flex-col items-center text-center mb-10">
                <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[30px] flex items-center justify-center mb-6 shadow-xl shadow-red-200">
                  <AlertCircle size={40} />
                </div>
                <h2 className="text-3xl font-sans font-thin text-blue-950 tracking-tight leading-none">Mazeret Kayıt Formu</h2>
                <p className="text-blue-950/30 text-[11px] font-medium leading-relaxed mt-4 uppercase tracking-widest px-4">
                  BEYANINIZ SİSTEME İŞLENECEK VE GÖREV DEVRİ GERÇEKLEŞECEKTİR.
                </p>
              </div>
              
              <textarea
                className="w-full bg-blue-50/50 border border-blue-50 rounded-3xl p-6 text-[15px] font-normal text-blue-950 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none resize-none transition-all placeholder:text-blue-950/20"
                rows={3}
                placeholder="Nedenini kısaca belirtin..."
                value={mazeretSebebi}
                onChange={(e) => setMazeretSebebi(e.target.value)}
                autoFocus
              />

              <div className="mt-4 flex items-start gap-3">
                <input 
                  type="checkbox" 
                  id="onay" 
                  checked={onay}
                  onChange={(e) => setOnay(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="onay" className="text-xs text-blue-950/60 leading-relaxed cursor-pointer select-none">
                  Mazeretimin geri alınamayacağını ve görev devrinin gerçekleşeceğini anladım ve onaylıyorum.
                </label>
              </div>
              
              <div className="flex flex-col gap-4 mt-8">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={submitMazeret}
                  disabled={isSubmitting || !mazeretSebebi.trim() || !onay}
                  className="w-full py-5 bg-red-600 text-white font-medium rounded-3xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-red-600/30 text-[13px] tracking-widest uppercase"
                >
                  {isSubmitting ? 'İŞLENİYOR...' : 'KAYDI TAMAMLA'}
                </motion.button>
                <button 
                  onClick={() => setIsMazeretModalOpen(false)}
                  className="w-full py-4 text-blue-950/30 font-medium text-[11px] tracking-widest uppercase hover:text-blue-950 transition"
                >
                  VAZGEÇ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
