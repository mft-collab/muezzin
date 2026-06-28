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
 const docId = `${settings.ilceId}_${yil}-${ay.toString().padStart(2, '0')}`;
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
 <div className="w-14 h-14 border-4 border-[var(--dynamic-aura,var(--aura-indigo))]/10 border-t-[var(--dynamic-aura,var(--aura-indigo))] rounded-full animate-spin shadow-[var(--spatial-shadow)]" />
 <p className="authority-title !text-[9px] opacity-20 tracking-wide uppercase italic">Veri Kanalları Senkronize Ediliyor</p>
 </div>
 </div>
 );

 return (
 <div className="flex flex-col gap-10">
 {/* HEADER: Service Status */}
 <div className="flex justify-between items-center">
 <div className="flex flex-col gap-2">
 <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Veri Senkronizasyonu</h2>
 <p className="authority-title !text-[7px] opacity-30 font-medium tracking-wide">EZAN VAKTİ ÖNBELLEK VE API YÖNETİMİ</p>
 </div>

 <div className="flex items-center gap-4 px-6 py-3 spatial-glass rounded-[22px] border border-white/5">
 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
 <span className="authority-title !text-[8px] font-bold tracking-wide uppercase text-emerald-500">SERVİS: AKTİF</span>
 </div>
 </div>

 {/* FEEDBACK: Status Messages */}
 <AnimatePresence mode="wait">
 {uiMessage && (
 <motion.div 
 initial={{ opacity: 0, y: -20, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, scale: 0.98 }}
 className={`p-6 rounded-[28px] flex items-center gap-4 spatial-glass border shadow-[var(--spatial-shadow)] ${
 uiMessage.type === 'success' 
 ? 'border-emerald-500/20 text-emerald-400' 
 : 'border-rose-500/20 text-rose-400'
 }`}
 >
 {uiMessage.type === 'success' ? <CheckCircle2 size={24} strokeWidth={1.2} /> : <AlertCircle size={24} strokeWidth={1.2} />}
 <p className="text-[10px] font-bold uppercase tracking-wide">{uiMessage.text}</p>
 </motion.div>
 )}
 </AnimatePresence>

 <div className="grid grid-cols-1 gap-8">
 <div className="space-y-8">
 {/* API SOURCE SECTION */}
 <section className="p-1 sm:p-10 relative overflow-hidden rounded-[20px] sm:rounded-[40px] border-none sm:border border-[var(--glass-border)] sm:spatial-glass-elevated sm:shadow-[var(--spatial-shadow)] group bg-transparent">
 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--dynamic-aura,var(--aura-indigo))]/20 to-transparent" />
 
 <div className="flex items-center gap-3 sm:gap-6 mb-6 sm:mb-12 relative z-10">
 <div className="w-10 h-10 sm:w-14 sm:h-14 bg-[var(--surface-low)] text-[var(--dynamic-aura,var(--aura-indigo))] rounded-[16px] sm:rounded-[22px] flex items-center justify-center border border-[var(--glass-border)] shadow-inner transition-transform duration-700">
 <Globe className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.2} />
 </div>
 <div>
 <h3 className="text-lg sm:text-xl font-light text-[var(--text-primary)] tracking-tight leading-none mb-1.5">Senkronizasyon Merkezi</h3>
 <p className="authority-title !text-[7px] opacity-30 uppercase tracking-wide">DIŞ VERİ KAYNAĞI VE PROTOKOL SEÇİMİ</p>
 </div>
 </div>
 
 <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-6 sm:mb-12 relative z-10">
 {['diyanet', 'aladhan', 'london'].map((k) => (
 <motion.button 
 key={k}
 whileHover={{ y: -5, scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => setApiKaynak(k)}
 className={`p-3 sm:p-8 rounded-[16px] sm:rounded-[32px] border transition-all duration-700 flex flex-col items-center gap-2 sm:gap-6 relative overflow-hidden group ${
 apiKaynak === k 
 ? 'border-[var(--dynamic-aura,var(--aura-indigo))]/30 bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] shadow-[var(--spatial-shadow)] shadow-[var(--dynamic-aura,var(--aura-indigo))]/5' 
 : 'border-[var(--glass-border)] bg-[var(--surface-low)] text-[var(--text-primary)]/40 hover:bg-[var(--surface-medium)] hover:border-[var(--text-primary)]/20'
 }`}
 >
 <span className={`authority-title !text-[7px] sm:!text-[9px] font-bold tracking-wide uppercase transition-all duration-700 ${
 apiKaynak === k ? 'text-[var(--dynamic-aura,var(--aura-indigo))] opacity-100' : 'opacity-30'
 }`}>
 {k === 'diyanet' ? 'DİYANET' : k === 'aladhan' ? 'ALADHAN' : 'LONDON'}
 </span>
 <div className={`w-9 h-9 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-700 ${
 apiKaynak === k ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-white shadow-lg shadow-[var(--dynamic-aura,var(--aura-indigo))]/20' : 'bg-[var(--surface-medium)] text-[var(--text-primary)]/20'
 }`}>
 <Globe className="w-4 h-4 sm:w-6 sm:h-6" strokeWidth={1.2} />
 </div>
 </motion.button>
 ))}
 </div>
 
 <div className="flex justify-end mb-6 sm:mb-10 relative z-10">
 <motion.button 
 whileHover={{ y: -5, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
 whileTap={{ scale: 0.98 }}
 onClick={handleSenkronizeEt}
 className="w-full sm:w-auto px-6 py-3.5 sm:px-10 sm:py-5 bg-white text-black rounded-[14px] sm:rounded-[22px] uppercase tracking-wide text-[9px] sm:text-[10px] flex items-center justify-center gap-4 transition-all font-bold shadow-[var(--spatial-shadow)] cursor-pointer"
 >
 <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
 <span>VERİLERİ SENKRONİZE ET</span>
 </motion.button>
 </div>

 {/* DATA MATRIX TABLE */}
 <div className="hidden md:block spatial-glass rounded-[32px] overflow-hidden border border-[var(--glass-border)] relative z-10">
 <table className="w-full text-left">
 <thead>
 <tr className="authority-title !text-[8px] opacity-30 uppercase tracking-wide border-b border-[var(--glass-border)]">
 <th className="px-10 py-6 font-bold">ZAMAN REFERANSI</th>
 <th className="px-10 py-6 font-bold">SAĞLAYICI</th>
 <th className="px-10 py-6 font-bold text-right">DURUM</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--glass-border)]">
 {onbellekler.length === 0 ? (
 <tr>
 <td colSpan={3} className="px-10 py-20 text-center">
 <p className="authority-title !text-[10px] opacity-20 uppercase tracking-wide font-bold">KAYITLI ÖNBELLEK BULUNAMADI</p>
 </td>
 </tr>
 ) : (
 onbellekler.map((o, idx) => (
 <motion.tr 
 key={o.id}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: idx * 0.05 }}
 className="group hover:bg-[var(--surface-low)] transition-all duration-500 cursor-default"
 >
 <td className="px-10 py-6">
 <div className="flex flex-col gap-1.5">
 <span className="text-lg font-light text-[var(--text-primary)] tracking-tight leading-none group-hover:text-[var(--dynamic-aura,var(--aura-indigo))] transition-colors">{o.id.toUpperCase()}</span>
 <div className="flex items-center gap-3">
 <div className={`w-1.5 h-1.5 rounded-full ${o.guncellenmeTarihi ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_8px_var(--dynamic-aura,var(--aura-indigo))]' : 'bg-[var(--text-primary)]/10'}`} />
 <span className="authority-title !text-[7px] opacity-20 font-bold uppercase tracking-wide">
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
 <span className="px-3 py-1 rounded-lg bg-[var(--surface-low)] border border-[var(--glass-border)] text-[9px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:border-[var(--text-primary)]/20 transition-all uppercase">
 {o.kaynakApi?.toUpperCase() || 'OTONOM'}
 </span>
 </td>
 <td className="px-10 py-6 text-right">
 <div className="flex items-center justify-end gap-3 text-emerald-500/40 group-hover:text-emerald-400 transition-all duration-700">
 <span className="authority-title !text-[8px] font-bold uppercase tracking-wide">SİSTEM GÜNCEL</span>
 <CheckCircle2 size={16} strokeWidth={1.5} />
 </div>
 </td>
 </motion.tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 {/* MOBILE ARCHIVE CARDS (Fallback) */}
 <div className="md:hidden flex flex-col gap-4 relative z-10">
 {onbellekler.length === 0 ? (
 <div className="spatial-glass p-8 text-center rounded-[24px]">
 <p className="authority-title !text-[10px] opacity-20 uppercase tracking-wide font-bold">KAYITLI ÖNBELLEK BULUNAMADI</p>
 </div>
 ) : (
 onbellekler.map((o, idx) => (
 <motion.div 
 key={o.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: idx * 0.05 }}
 className="spatial-glass-elevated p-4 rounded-[20px] space-y-3.5 border border-[var(--glass-border)]"
 >
 <div className="flex justify-between items-center">
 <h4 className="text-sm sm:text-base font-light text-[var(--text-primary)] tracking-tight leading-none">{o.id.toUpperCase()}</h4>
 <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] border border-[var(--glass-border)] text-[8px] font-bold text-[var(--text-secondary)] tracking-wide uppercase">
 {o.kaynakApi?.toUpperCase() || 'OTONOM'}
 </span>
 </div>
 <div className="flex flex-col gap-1 text-xs">
 <span className="authority-title !text-[6px] opacity-30 uppercase tracking-wide">SON SENKRONİZASYON</span>
 <span className="text-[10px] font-medium text-[var(--text-secondary)]/90">
 {o.guncellenmeTarihi 
 ? format(
 typeof o.guncellenmeTarihi?.toDate === 'function' ? o.guncellenmeTarihi.toDate() : new Date(o.guncellenmeTarihi?.seconds ? o.guncellenmeTarihi.seconds * 1000 : o.guncellenmeTarihi), 
 'dd MMMM yyyy • HH:mm', 
 { locale: tr }
 ).toUpperCase() 
 : 'SİSTEM KAYDI YOK'}
 </span>
 </div>
 <div className="flex items-center gap-2 pt-2 border-t border-[var(--glass-border)] text-emerald-400">
 <CheckCircle2 size={14} strokeWidth={1.5} />
 <span className="authority-title !text-[7px] font-bold uppercase tracking-wide">SİSTEM GÜNCEL</span>
 </div>
 </motion.div>
 ))
 )}
 </div>
 </section>

 {/* INFO PANEL */}
 <div className="p-4 sm:p-8 spatial-glass rounded-[20px] sm:rounded-[32px] border border-[var(--glass-border)] flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 group hover:bg-[var(--surface-low)] transition-all duration-700 shadow-[var(--spatial-shadow)]">
 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/[0.03] flex items-center justify-center text-white/20 group-hover:text-[var(--dynamic-aura,var(--aura-indigo))] transition-colors shrink-0">
 <Info className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.2} />
 </div>
 <div className="flex flex-col gap-2">
 <p className="authority-title !text-[8px] font-bold text-white tracking-wide uppercase opacity-30">OTOMATİK SENKRONİZASYON PROTOLÜ</p>
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
