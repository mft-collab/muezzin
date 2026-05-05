import React, { useState } from 'react';
import { useAdminIzinler } from '../../../hooks/admin/useAdminIzinler';
import { useMuezzinler } from '../../../hooks/admin/useMuezzinler';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Calendar, User, Clock, FileText, Filter } from 'lucide-react';

export default function IzinYonetimi() {
  const { izinler, loading, error, izinGuncelle } = useAdminIzinler();
  const { muezzinler } = useMuezzinler();
  const [filter, setFilter] = useState<'all' | 'onay_bekliyor' | 'onaylandi' | 'reddedildi'>('all');

  const getMuezzinName = (uid: string) => {
    return muezzinler.find(m => m.id === uid)?.displayName || 'Bilinmiyor';
  };

  const filteredIzinler = izinler.filter(i => {
    if (filter === 'all') return true;
    return i.durum === filter;
  });

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-600"></div>
    </div>
  );

  if (error) return (
    <div className="p-10 bg-rose-50 border border-rose-100 rounded-[32px] text-center">
      <p className="text-rose-600 font-bold mb-2">Veriler yüklenirken bir hata oluştu</p>
      <p className="text-xs text-rose-400">{error}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Search & Filter Header */}
      <section className="bg-white/70 backdrop-blur-2xl rounded-2xl border border-slate-200/60 p-4 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Talep Durumuna Göre Filtrele</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'TÜM TALEPLER' },
                { id: 'onay_bekliyor', label: 'ONAY BEKLEYEN' },
                { id: 'onaylandi', label: 'ONAYLANANLAR' },
                { id: 'reddedildi', label: 'REDDEDİLENLER' }
              ].map(btn => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    filter === btn.id 
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Requests List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredIzinler.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 text-center bg-white/40 rounded-2xl border border-dashed border-slate-200"
            >
              <Calendar className="mx-auto text-slate-300 mb-4" size={32} />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest italic">Herhangi bir kayıt bulunamadı</p>
            </motion.div>
          ) : filteredIzinler.map((izin, idx) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={izin.id}
              className="group bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-slate-200 transition-all overflow-hidden relative"
            >
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    izin.durum === 'onay_bekliyor' ? 'bg-amber-100 text-amber-600' : 
                    izin.durum === 'onaylandi' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                  }`}>
                    <User size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-none mb-1">{getMuezzinName(izin.uid)}</h3>
                    <div className="flex items-center gap-2">
                       <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                         izin.tip === 'yillik' ? 'bg-indigo-50 text-indigo-600' :
                         izin.tip === 'haftalik' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                       }`}>
                         {izin.tip === 'yillik' ? 'Yıllık İzin' : izin.tip === 'haftalik' ? 'Haftalık İzin' : 'Mazeret İzni'}
                       </span>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex-1 flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg border border-slate-100"><Calendar size={14} /></div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Başlangıç</p>
                      <p className="text-[11px] font-bold text-slate-700">{format(parseISO(izin.baslangic), 'd MMM yyyy, EEE', { locale: tr })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-400 rounded-lg border border-slate-100"><Clock size={14} /></div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Bitiş</p>
                      <p className="text-[11px] font-bold text-slate-700">{format(parseISO(izin.bitis), 'd MMM yyyy, EEE', { locale: tr })}</p>
                    </div>
                  </div>
                </div>

                {/* Desc */}
                <div className="flex-1 flex flex-col gap-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                   <div className="flex items-center gap-1.5 text-slate-400">
                      <FileText size={10} />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Açıklama / Sebep</span>
                   </div>
                   <p className="text-[10px] font-medium text-slate-600 italic leading-snug">"{izin.sebep || 'Sebep belirtilmemiş.'}"</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 lg:ml-auto">
                  {izin.durum === 'onay_bekliyor' ? (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => izinGuncelle(izin.id!, 'onaylandi')}
                        className="p-2 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition-colors"
                        title="Onayla"
                      >
                        <Check size={16} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => izinGuncelle(izin.id!, 'reddedildi')}
                        className="p-2 bg-rose-600 text-white rounded-xl shadow-md shadow-rose-600/20 hover:bg-rose-500 transition-colors"
                        title="Reddet"
                      >
                        <X size={16} />
                      </motion.button>
                    </>
                  ) : (
                    <div className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest border ${
                      izin.durum === 'onaylandi' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                    }`}>
                      {izin.durum === 'onaylandi' ? 'ONAYLANDI' : 'REDDEDİLDİ'}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
