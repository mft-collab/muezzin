import React, { useState } from 'react';
import { useAdminIzinler } from '../../../hooks/admin/useAdminIzinler';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Calendar, User, Clock, FileText, Filter, Trash2, AlertCircle } from 'lucide-react';

export default function IzinYonetimi() {
  const { izinler, loading, error, izinGuncelle, izinSil } = useAdminIzinler();
  const muezzinler = useMuezzinStore(s => s.muezzinler);
  const [filter, setFilter] = useState<'all' | 'onay_bekliyor' | 'onaylandi' | 'reddedildi'>('all');

  const getMuezzinName = (uid: string) => {
    return muezzinler.find(m => m.id === uid)?.displayName || 'Bilinmiyor';
  };

  const filteredIzinler = izinler.filter(i => {
    if (filter === 'all') return true;
    return i.durum === filter;
  });

  if (loading) return (
    <div className="flex h-[500px] items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-14 h-14 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-xl" />
        <p className="authority-title !text-[9px] opacity-20 tracking-[0.5em] uppercase">Talep Verileri Senkronize Ediliyor</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="spatial-glass p-12 rounded-[32px] border-rose-500/20 text-center flex flex-col items-center">
      <AlertCircle className="text-rose-500 mb-6" size={40} />
      <p className="text-lg font-light text-rose-500 tracking-tight mb-2">Veri Senkronizasyon Hatası</p>
      <p className="authority-title !text-[7px] opacity-40 uppercase tracking-[0.2em]">{error}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-10">
      {/* TOOLBAR: Filter Stream */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">İzin ve Mazeret Masası</h2>
           <p className="authority-title !text-[7px] opacity-30 font-medium tracking-[0.2em]">PERSONEL İSTİRAHAT VE GÖREV MUAFİYETLERİ</p>
        </div>

        <div className="flex items-center gap-2 bg-white/[0.02] p-1.5 rounded-[22px] border border-white/5 shadow-2xl overflow-x-auto no-scrollbar max-w-full pb-1 shrink-0">
          {[
            { id: 'all', label: 'TÜMÜ' },
            { id: 'onay_bekliyor', label: 'BEKLEYEN' },
            { id: 'onaylandi', label: 'ONAYLANDI' },
            { id: 'reddedildi', label: 'RED' }
          ].map(btn => (
            <motion.button
              key={btn.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(btn.id as any)}
              className={`px-6 py-3 rounded-[18px] text-[8px] font-bold uppercase tracking-[0.15em] transition-all duration-500 shrink-0 ${
                filter === btn.id 
                ? 'bg-white text-black shadow-xl shadow-white/5' 
                : 'bg-transparent text-white/30 hover:text-white hover:bg-white/5'
              }`}
            >
              {btn.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* REQUEST GRID: Spatial Decision Stream */}
      <div className="grid grid-cols-1 gap-5">
        <AnimatePresence mode="popLayout">
          {filteredIzinler.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="spatial-glass p-20 rounded-[48px] text-center flex flex-col items-center max-w-2xl mx-auto border-dashed border-white/10"
            >
              <Calendar className="text-white/5 mb-8" size={60} strokeWidth={1} />
              <p className="authority-title !text-[8px] opacity-40 uppercase tracking-[0.3em]">HİÇBİR İZİN TALEBİ KAYDI BULUNAMADI</p>
            </motion.div>
          ) : filteredIzinler.map((izin, idx) => {
            const statusColor = izin.durum === 'onay_bekliyor' ? 'amber' : 
                                izin.durum === 'onaylandi' ? 'emerald' : 'rose';
            
            return (
              <motion.div
                key={izin.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30, delay: idx * 0.05 }}
                className={`group spatial-glass p-6 transition-all duration-700 relative overflow-hidden flex flex-col lg:flex-row lg:items-center gap-8 border border-white/5 ${
                  izin.durum === 'onay_bekliyor' ? 'hover:bg-amber-500/[0.02]' : 
                  izin.durum === 'onaylandi' ? 'hover:bg-emerald-500/[0.02]' : 'hover:bg-rose-500/[0.02]'
                }`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 bottom-0 w-1 bg-${statusColor}-500/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]`} />

                {/* Personel Identity */}
                <div className="flex items-center gap-5 min-w-[240px]">
                  <div className={`w-14 h-14 rounded-[22px] flex items-center justify-center shadow-lg border transition-all duration-700 ${
                    izin.durum === 'onay_bekliyor' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                    izin.durum === 'onaylandi' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  }`}>
                    <User size={24} strokeWidth={1.2} />
                  </div>
                  <div>
                    <h3 className="text-xl font-light text-white tracking-tight leading-none mb-2">{getMuezzinName(izin.uid)}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-[7px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded border border-white/5 ${
                        izin.durum === 'onay_bekliyor' ? 'text-amber-500/60' : 
                        izin.durum === 'onaylandi' ? 'text-emerald-500/60' : 'text-rose-500/60'
                      }`}>
                        {izin.tip === 'yillik' ? 'Yıllık İzin' : izin.tip === 'haftalik' ? 'Haftalık İzin' : 'Mazeret İzni'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Temporal Matrix */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8 lg:px-8 lg:border-x lg:border-y-0 border-y border-white/5 py-4 lg:py-0 w-full lg:w-auto">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                       <span className="authority-title !text-[6px] opacity-20 uppercase tracking-[0.2em] mb-1">BAŞLANGIÇ</span>
                       <span className="text-[12px] font-bold text-white/70 tracking-widest">{format(parseISO(izin.baslangic), 'd MMM yyyy', { locale: tr })}</span>
                    </div>
                    <div className="w-8 h-px bg-white/10" />
                    <div className="flex flex-col">
                       <span className="authority-title !text-[6px] opacity-20 uppercase tracking-[0.2em] mb-1">BİTİŞ</span>
                       <span className="text-[12px] font-bold text-white/70 tracking-widest">{format(parseISO(izin.bitis), 'd MMM yyyy', { locale: tr })}</span>
                    </div>
                  </div>
                </div>

                {/* Reason Matrix */}
                <div className="flex-1 p-5 spatial-glass-elevated rounded-[24px] border border-white/5 bg-white/[0.01]">
                   <p className="text-[12px] font-light text-white/40 leading-relaxed italic">
                     "{izin.sebep || 'Herhangi bir mazeret detayı belirtilmedi.'}"
                   </p>
                </div>

                {/* Decision Matrix */}
                <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-start lg:ml-auto border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
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
                            if (d.getDay() === 5) { hasFriday = true; break; }
                          }
                          if (hasFriday) {
                            alert("Cuma günü operasyonel gereklilikler nedeniyle izin onaylanamaz.");
                            return;
                          }
                          izinGuncelle(izin.id!, 'onaylandi');
                        }}
                        className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5 transition-colors"
                      >
                        <Check size={20} />
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ y: -4, scale: 1.05, backgroundColor: 'rgba(244,63,94,0.2)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => izinGuncelle(izin.id!, 'reddedildi')}
                        className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-lg shadow-rose-500/5 transition-colors"
                      >
                        <X size={20} />
                      </motion.button>
                    </div>
                  ) : (
                    <div className={`px-6 py-2 rounded-full text-[8px] font-bold uppercase tracking-[0.2em] border shadow-sm ${
                      izin.durum === 'onaylandi' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                      {izin.durum === 'onaylandi' ? 'SİSTEM TARAFINDAN ONAYLI' : 'TALEP REDDEDİLDİ'}
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(244,63,94,0.1)' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      if (window.confirm('Bu izin kaydını kalıcı olarak silmek istediğinize emin misiniz?')) {
                        izinSil(izin.id!);
                      }
                    }}
                    className="w-12 h-12 bg-white/[0.03] text-white/10 rounded-2xl flex items-center justify-center border border-white/5 hover:text-rose-500 hover:border-rose-500/20 transition-all shadow-lg"
                  >
                    <Trash2 size={16} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
