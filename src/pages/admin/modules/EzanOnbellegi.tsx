import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { aylikVakitleriCek } from '../../../services/ezanVaktiServisi';
import { db } from '../../../lib/firebase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AylikVakitler } from '../../../types';
import { Globe, RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useSystemSettingsStore } from '../../../store/useSystemSettingsStore';

export default function EzanOnbellegi() {
  const { settings } = useSystemSettingsStore();
  const [onbellekler, setOnbellekler] = useState<(AylikVakitler & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKaynak, setApiKaynak] = useState('diyanet');
  const [uiMessage, setUiMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(false);
        setUiMessage({ type: 'error', text: 'SUNUCU YANIT VERMEDİ.' });
      }
    }, 15000);

    const fetchVakitler = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'vakitler'));
        const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as (AylikVakitler & { id: string })[];
        data.sort((a, b) => b.id.localeCompare(a.id));
        if (mounted) {
          setOnbellekler(data);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (error) {
        if (mounted) {
          setLoading(false);
          setUiMessage({ type: 'error', text: 'VERİTABANI HATASI.' });
          clearTimeout(timeoutId);
        }
      }
    };

    fetchVakitler();
    return () => { 
      mounted = false; 
      clearTimeout(timeoutId);
    };
  }, []);

  const handleSenkronizeEt = async () => {
    setLoading(true);
    setUiMessage(null);
    try {
      const yil = new Date().getFullYear();
      const ay = new Date().getMonth() + 1;
      const apiVerisi = await aylikVakitleriCek(yil, ay, settings.ilceId, settings.ilceAdi);
      const docId = `${yil}-${ay.toString().padStart(2, '0')}`;
      await setDoc(doc(db, 'vakitler', docId), apiVerisi);
      const snapshot = await getDocs(collection(db, 'vakitler'));
      const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as (AylikVakitler & { id: string })[];
      data.sort((a, b) => b.id.localeCompare(a.id));
      setOnbellekler(data);
      setUiMessage({ type: 'success', text: 'SENKRONİZASYON TAMAMLANDI.' });
    } catch (error) {
      setUiMessage({ type: 'error', text: 'API BAĞLANTI HATASI.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex h-[500px] items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-14 h-14 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-xl" />
        <p className="authority-title !text-[9px] opacity-20 tracking-[0.5em] uppercase italic">Veri Kanalları Senkronize Ediliyor</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-10">
      {/* HEADER: Service Status */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Veri Senkronizasyonu</h2>
           <p className="authority-title !text-[7px] opacity-30 font-medium tracking-[0.2em]">EZAN VAKTİ ÖNBELLEK VE API YÖNETİMİ</p>
        </div>

        <div className="flex items-center gap-4 px-6 py-3 spatial-glass rounded-[22px] border border-white/5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
          <span className="authority-title !text-[8px] font-bold tracking-[0.2em] uppercase text-emerald-500">SERVİS: AKTİF</span>
        </div>
      </div>

      {/* FEEDBACK: Status Messages */}
      <AnimatePresence mode="wait">
        {uiMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={`p-6 rounded-[28px] flex items-center gap-4 spatial-glass border shadow-2xl ${
              uiMessage.type === 'success' 
              ? 'border-emerald-500/20 text-emerald-400' 
              : 'border-rose-500/20 text-rose-400'
            }`}
          >
            {uiMessage.type === 'success' ? <CheckCircle2 size={24} strokeWidth={1.2} /> : <AlertCircle size={24} strokeWidth={1.2} />}
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{uiMessage.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-8">
         <div className="space-y-8">
            {/* API SOURCE SECTION */}
            <section className="spatial-glass-elevated rounded-[40px] p-10 border border-white/5 relative overflow-hidden group shadow-2xl">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
               
               <div className="flex items-center gap-6 mb-12 relative z-10">
                  <div className="w-14 h-14 bg-white/[0.03] text-indigo-400 rounded-[22px] flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-700">
                    <Globe size={24} strokeWidth={1.2} />
                  </div>
                  <div>
                    <h3 className="text-xl font-light text-white tracking-tight leading-none mb-1.5">Senkronizasyon Merkezi</h3>
                    <p className="authority-title !text-[7px] opacity-30 uppercase tracking-[0.3em]">DIŞ VERİ KAYNAĞI VE PROTOKOL SEÇİMİ</p>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 relative z-10">
                  {['diyanet', 'aladhan', 'london'].map((k) => (
                     <motion.button 
                        key={k}
                        whileHover={{ y: -5, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setApiKaynak(k)}
                        className={`p-8 rounded-[32px] border transition-all duration-700 flex flex-col items-center gap-6 relative overflow-hidden group ${
                           apiKaynak === k 
                           ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shadow-2xl shadow-indigo-500/5' 
                           : 'border-white/5 bg-white/[0.02] text-white/20 hover:bg-white/[0.04] hover:border-white/10'
                        }`}
                     >
                        <span className={`authority-title !text-[9px] font-bold tracking-[0.4em] uppercase transition-all duration-700 ${
                           apiKaynak === k ? 'text-indigo-400 opacity-100' : 'opacity-30'
                        }`}>
                           {k === 'diyanet' ? 'DİYANET' : k === 'aladhan' ? 'ALADHAN' : 'LONDON'}
                        </span>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 ${
                           apiKaynak === k ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-white/10'
                        }`}>
                           <Globe size={24} strokeWidth={1.2} />
                        </div>
                     </motion.button>
                  ))}
               </div>
               
               <div className="flex justify-end mb-10 relative z-10">
                  <motion.button 
                    whileHover={{ y: -5, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSenkronizeEt}
                    className="px-10 py-5 bg-white text-black rounded-[22px] uppercase tracking-[0.3em] text-[10px] flex items-center gap-4 transition-all font-bold shadow-2xl"
                  >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    <span>VERİLERİ SENKRONİZE ET</span>
                  </motion.button>
               </div>

               {/* DATA MATRIX TABLE */}
               <div className="spatial-glass rounded-[32px] overflow-hidden border border-white/5 relative z-10">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="authority-title !text-[8px] opacity-30 uppercase tracking-[0.4em] border-b border-white/5">
                           <th className="px-10 py-6 font-bold">ZAMAN REFERANSI</th>
                           <th className="px-10 py-6 font-bold">SAĞLAYICI</th>
                           <th className="px-10 py-6 font-bold text-right">DURUM</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/[0.02]">
                        {onbellekler.length === 0 ? (
                           <tr>
                              <td colSpan={3} className="px-10 py-20 text-center">
                                 <p className="authority-title !text-[10px] opacity-20 uppercase tracking-[0.5em] font-bold">KAYITLI ÖNBELLEK BULUNAMADI</p>
                              </td>
                           </tr>
                        ) : (
                           onbellekler.map((o, idx) => (
                               <motion.tr 
                                 key={o.id}
                                 initial={{ opacity: 0, x: -10 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 transition={{ delay: idx * 0.05 }}
                                 className="group hover:bg-white/[0.02] transition-all duration-500 cursor-default"
                               >
                                  <td className="px-10 py-6">
                                     <div className="flex flex-col gap-1.5">
                                        <span className="text-lg font-light text-white tracking-tight leading-none group-hover:text-indigo-400 transition-colors">{o.id.toUpperCase()}</span>
                                        <div className="flex items-center gap-3">
                                          <div className={`w-1.5 h-1.5 rounded-full ${o.guncellenmeTarihi ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-white/10'}`} />
                                          <span className="authority-title !text-[7px] opacity-20 font-bold uppercase tracking-[0.2em]">
                                            {o.guncellenmeTarihi 
                                              ? format(
                                                  typeof o.guncellenmeTarihi?.toDate === 'function' ? o.guncellenmeTarihi.toDate() : new Date(o.guncellenmeTarihi?.seconds ? o.guncellenmeTarihi.seconds * 1000 : o.guncellenmeTarihi), 
                                                  'dd MMMM yyyy • HH:mm', 
                                                  { locale: tr }
                                                ).toUpperCase() 
                                              : 'SİSTEM KAYDI YOK'}
                                          </span>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-10 py-6">
                                     <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-white/40 tracking-[0.2em] group-hover:text-white group-hover:border-white/10 transition-all uppercase">
                                        {o.kaynakApi?.toUpperCase() || 'OTONOM'}
                                     </span>
                                  </td>
                                  <td className="px-10 py-6 text-right">
                                     <div className="flex items-center justify-end gap-3 text-emerald-500/40 group-hover:text-emerald-400 transition-all duration-700">
                                        <span className="authority-title !text-[8px] font-bold uppercase tracking-[0.2em]">SİSTEM GÜNCEL</span>
                                        <CheckCircle2 size={16} strokeWidth={1.5} />
                                     </div>
                                  </td>
                               </motion.tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </section>

            {/* INFO PANEL */}
            <div className="p-8 spatial-glass rounded-[32px] border border-white/5 flex items-start gap-6 group hover:bg-white/[0.01] transition-all duration-700 shadow-xl">
               <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-white/20 group-hover:text-indigo-400 transition-colors">
                 <Info size={24} strokeWidth={1.2} />
               </div>
               <div className="flex flex-col gap-2">
                 <p className="authority-title !text-[8px] font-bold text-white tracking-[0.3em] uppercase opacity-30">OTOMATİK SENKRONİZASYON PROTOLÜ</p>
                 <p className="text-[12px] font-light text-white/40 leading-relaxed max-w-3xl italic">
                    Sistem verileri her gece saat 03:00'da Diyanet API kanalı üzerinden otomatik olarak senkronize edilir. 
                    Veri sapmaları durumunda manuel senkronizasyon yetkiniz bulunmaktadır.
                 </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
