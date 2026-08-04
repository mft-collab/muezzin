import React, { useState } from 'react';
import { useAdminIzinlerStore } from '../../../store/useAdminIzinlerStore';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Calendar, User, Trash2, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { isFriday } from '../../../lib/dateUtils';

export default function IzinYonetimi() {
 const { izinler, loading, error, izinGuncelle, izinSil } = useAdminIzinlerStore();
 const muezzinler = useMuezzinStore(s => s.muezzinler);
 const [filter, setFilter] = useState<'all' | 'onay_bekliyor' | 'onaylandi' | 'reddedildi'>('all');
 const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
 const [uiMessage, setUiMessage] = useState<string | null>(null);
 const [processingIzinId, setProcessingIzinId] = useState<string | null>(null);

 const getMuezzinName = (uid: string) => {
 return muezzinler.find(m => m.id === uid)?.displayName || 'Bilinmiyor';
 };

  const filteredIzinler = izinler.filter(i => {
  if (filter === 'all') return true;
  return i.durum === filter;
  });

 const kararVer = async (id: string, durum: 'onaylandi' | 'reddedildi') => {
 setProcessingIzinId(id);
 try {
 await izinGuncelle(id, durum);
 } catch {
 setUiMessage('İzin kararı işlenemedi. Bağlantı veya yetki durumunu kontrol edin.');
 } finally {
 setProcessingIzinId(null);
 }
 };

 if (loading) return (
 <div className="flex h-[500px] items-center justify-center">
 <div className="flex flex-col items-center gap-6">
 <div className="w-14 h-14 border-4 border-[var(--dynamic-aura,var(--aura-indigo))]/10 border-t-[var(--dynamic-aura,var(--aura-indigo))] rounded-full animate-spin shadow-[var(--spatial-shadow)]" />
 <p className="authority-title !text-2xs opacity-20 tracking-wide uppercase">Talep Verileri Senkronize Ediliyor</p>
 </div>
 </div>
 );

 if (error) return (
 <div className="spatial-glass p-12 rounded-card border-rose-500/20 text-center flex flex-col items-center max-w-full overflow-hidden">
 <AlertCircle className="text-rose-500 mb-6" size={40} />
 <p className="text-lg font-light text-rose-500 tracking-tight mb-2">Veri Senkronizasyon Hatası</p>
 <p className="authority-title !text-2xs opacity-55 uppercase tracking-wide break-all whitespace-normal w-full max-w-full text-center select-all">{error}</p>
 </div>
 );

 return (
 <div className="flex flex-col gap-10">
 {/* TOOLBAR: Filter Stream */}
 <div className="flex flex-col md:flex-row justify-between items-center gap-6">
 <div className="flex flex-col gap-2">
 <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">İzin ve Mazeret Masası</h2>
 <p className="authority-title !text-2xs opacity-40 font-medium tracking-wide">PERSONEL İSTİRAHAT VE GÖREV MUAFİYETLERİ</p>
 </div>

 <div className="flex items-center gap-2 bg-[var(--surface-low)] p-1.5 rounded-[22px] border border-[var(--glass-border)] shadow-[var(--spatial-shadow)] overflow-x-auto no-scrollbar max-w-full pb-1 shrink-0">
 {(
 [
 { id: 'all', label: 'TÜMÜ' },
 { id: 'onay_bekliyor', label: 'BEKLEYEN' },
 { id: 'onaylandi', label: 'ONAYLANDI' },
 { id: 'reddedildi', label: 'RED' }
 ] as const
 ).map(btn => (
 <motion.button
 key={btn.id}
 whileHover={{ scale: 1.05 }}
 whileTap={{ scale: 0.95 }}
 onClick={() => {
 setFilter(btn.id);
 setUiMessage(null);
 }}
 className={`px-5 py-3 rounded-xl text-2xs font-bold uppercase tracking-wide transition-all duration-500 shrink-0 ${
 filter === btn.id 
 ? 'bg-[var(--text-primary)] text-[var(--app-bg)] shadow-[var(--spatial-shadow)]' 
 : 'bg-transparent text-[var(--text-primary)]/30 hover:text-[var(--text-primary)] hover:bg-[var(--surface-medium)]'
 }`}
 >
 {btn.label}
 </motion.button>
 ))}
 </div>
 </div>

 <AnimatePresence>
 {uiMessage && (
 <motion.div
 initial={{ opacity: 0, y: -8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 className="spatial-glass !bg-amber-500/10 border-amber-500/30 p-4 flex items-center gap-3 text-amber-500 text-2xs font-bold uppercase tracking-wide shadow-[var(--spatial-shadow)] rounded-2xl"
 >
 <AlertCircle size={18} className="shrink-0" />
 <span className="leading-relaxed">{uiMessage}</span>
 <button type="button" onClick={() => setUiMessage(null)} aria-label="Kapat" className="ml-auto text-amber-500/50 hover:text-amber-500 transition-colors">
 <X size={14} />
 </button>
 </motion.div>
 )}
 </AnimatePresence>

 {/* REQUEST GRID: Spatial Decision Stream */}
 <div className="grid grid-cols-1 gap-5">
 <AnimatePresence mode="popLayout">
 {filteredIzinler.length === 0 ? (
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="spatial-glass p-12 sm:p-16 rounded-card text-center flex flex-col items-center max-w-2xl mx-auto border-dashed border-[var(--text-primary)]/10"
 >
 <Calendar className="text-[var(--text-secondary)] mb-8" size={60} strokeWidth={1} />
 <p className="authority-title !text-2xs opacity-45 uppercase tracking-wide">HİÇBİR İZİN TALEBİ KAYDI BULUNAMADI</p>
 </motion.div>
  ) : filteredIzinler.map((izin, idx) => {
  const statusBarClass = izin.durum === 'onay_bekliyor' ? 'bg-amber-500/40' :
  izin.durum === 'onaylandi' ? 'bg-emerald-500/40' : 'bg-rose-500/40';
  const isProcessing = processingIzinId === izin.id;
 
 return (
 <motion.div
 key={izin.id}
 layout
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ type: "spring", stiffness: 400, damping: 30, delay: idx * 0.05 }}
 className={`group spatial-glass p-4 sm:p-6 transition-all duration-700 relative overflow-hidden flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-6 lg:gap-8 border border-[var(--glass-border)] !rounded-card ${
 izin.durum === 'onay_bekliyor' ? 'hover:bg-amber-500/[0.02]' : 
 izin.durum === 'onaylandi' ? 'hover:bg-emerald-500/[0.02]' : 'hover:bg-rose-500/[0.02]'
 }`}
 >
 {/* Status Indicator Bar */}
 <div className={`absolute top-0 left-0 bottom-0 w-1 ${statusBarClass} shadow-[0_0_15px_rgba(255,255,255,0.1)]`} />

 {/* Personel Identity */}
 <div className="flex items-center gap-5 min-w-0 lg:min-w-[240px] w-full lg:w-auto">
 <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-[16px] sm:rounded-[22px] flex items-center justify-center shadow-lg border transition-all duration-700 ${
 izin.durum === 'onay_bekliyor' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
 izin.durum === 'onaylandi' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
 }`}>
 <User className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.2} />
 </div>
 <div>
 <h3 className="text-xl font-light text-[var(--text-primary)] tracking-tight leading-none mb-2">{getMuezzinName(izin.uid)}</h3>
 <div className="flex items-center gap-2">
 <span className={`text-2xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border border-[var(--text-primary)]/5 ${
 izin.durum === 'onay_bekliyor' ? 'text-amber-500/60' : 
 izin.durum === 'onaylandi' ? 'text-emerald-500/60' : 'text-rose-500/60'
 }`}>
 {izin.tip === 'yillik' ? 'Yıllık İzin' : izin.tip === 'haftalik' ? 'Haftalık İzin' : 'Mazeret İzni'}
 </span>
 </div>
 </div>
 </div>

 {/* Temporal Matrix */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 lg:px-8 lg:border-x lg:border-y-0 border-y border-[var(--text-primary)]/5 py-3 lg:py-0 w-full lg:w-auto">
 <div className="flex items-center gap-4">
 <div className="flex flex-col">
 <span className="authority-title !text-2xs opacity-35 uppercase tracking-wide mb-1">BAŞLANGIÇ</span>
 <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]/75 tracking-wide">{format(parseISO(izin.baslangic), 'd MMM yyyy', { locale: tr })}</span>
 </div>
 <div className="w-8 h-px bg-[var(--glass-border)]" />
 <div className="flex flex-col">
 <span className="authority-title !text-2xs opacity-35 uppercase tracking-wide mb-1">BİTİŞ</span>
 <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]/75 tracking-wide">{format(parseISO(izin.bitis), 'd MMM yyyy', { locale: tr })}</span>
 </div>
 </div>
 </div>

 {/* Reason Matrix */}
 <div className="flex-1 p-4 bg-[var(--surface-low)] rounded-2xl border border-[var(--glass-border)]">
 <p className="text-xs sm:text-sm font-light text-[var(--text-primary)]/65 leading-relaxed italic">
 "{izin.sebep || 'Herhangi bir mazeret detayı belirtilmedi.'}"
 </p>
 </div>

 {/* Decision Matrix */}
 <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-start lg:ml-auto border-t lg:border-t-0 border-[var(--glass-border)] pt-3 lg:pt-0">
 {izin.durum === 'onay_bekliyor' ? (
 <div className="flex items-center gap-3">
 <motion.button
 whileHover={{ y: -4, scale: 1.05, backgroundColor: 'rgba(16,185,129,0.2)' }}
 whileTap={{ scale: 0.95 }}
 onClick={() => {
 const start = new Date(izin.baslangic);
 const end = new Date(izin.bitis);
 let hasFriday = false;
 for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
 if (isFriday(d)) { hasFriday = true; break; }
 }
  if (hasFriday) {
  if (izin.tip !== 'mazeret') {
  setUiMessage('Cuma günü yıllık veya haftalık izin onaylanamaz. Zorunlu mazeret izinleri yönetici kararıyla işlenebilir.');
  return;
  }
  }
  kararVer(izin.id!, 'onaylandi');
  }}
  disabled={isProcessing}
  aria-label="İzni onayla"
  className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 text-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5 transition-colors"
  >
 <Check className="w-5 h-5 sm:w-6 sm:h-6" />
 </motion.button>

  <motion.button
  whileHover={{ y: -4, scale: 1.05, backgroundColor: 'rgba(244,63,94,0.2)' }}
  whileTap={{ scale: 0.95 }}
  onClick={() => kararVer(izin.id!, 'reddedildi')}
  disabled={isProcessing}
  aria-label="İzni reddet"
  className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-500/10 text-rose-500 rounded-xl sm:rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-lg shadow-rose-500/5 transition-colors"
 >
 <X className="w-5 h-5 sm:w-6 sm:h-6" />
 </motion.button>
 </div>
 ) : (
 <div className={`px-4 sm:px-6 py-2 rounded-full text-2xs font-bold uppercase tracking-wide border shadow-sm ${
 izin.durum === 'onaylandi' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
 }`}>
 {izin.durum === 'onaylandi' ? 'SİSTEM TARAFINDAN ONAYLI' : 'TALEP REDDEDİLDİ'}
 </div>
 )}

 <motion.button
 whileHover={{ scale: 1.1, backgroundColor: 'rgba(244,63,94,0.1)' }}
 whileTap={{ scale: 0.9 }}
 onClick={() => setDeleteConfirm({ open: true, id: izin.id! })}
 aria-label="Kaydı sil"
 className="w-10 h-10 sm:w-12 sm:h-12 bg-[var(--surface-low)] text-[var(--text-secondary)]/30 rounded-xl sm:rounded-2xl flex items-center justify-center border border-[var(--glass-border)] hover:text-rose-500 hover:border-rose-500/20 transition-all shadow-lg"
 >
 <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
 </motion.button>
 </div>
 </motion.div>
 );
 })}
 </AnimatePresence>
 </div>

 <ConfirmModal
 isOpen={deleteConfirm.open}
 onClose={() => setDeleteConfirm({ open: false, id: null })}
 onConfirm={() => {
 if (deleteConfirm.id) izinSil(deleteConfirm.id);
 setDeleteConfirm({ open: false, id: null });
 }}
 title="KAYDI SİL"
 message="Bu izin kaydı kalıcı olarak silinecektir. Bu işlem geri alınamaz."
 isDanger={true}
 confirmText="EVET, SİL"
 />
 </div>
 );
}
