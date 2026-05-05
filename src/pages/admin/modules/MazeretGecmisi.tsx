import React, { useState } from 'react';
import { useMazeretGecmisi } from '../../../hooks/admin/useMazeretGecmisi';
import { useMuezzinler } from '../../../hooks/admin/useMuezzinler';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { FileDown, Filter, User } from 'lucide-react';

export default function MazeretGecmisi() {
  const { gecmis, loading } = useMazeretGecmisi();
  const { muezzinler } = useMuezzinler();
  
  const [selectedMuezzin, setSelectedMuezzin] = useState<string>('all');

  const getMuezzinName = (uid: string) => {
    return muezzinler.find(m => m.id === uid)?.displayName || 'Bilinmiyor';
  };

  const filtered = gecmis.filter(g => {
    if (selectedMuezzin !== 'all' && g.uid !== selectedMuezzin) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ['Tarih', 'Vakit', 'Müezzin', 'Mazeret Sebebi'];
    const rows = filtered.map(g => [
      g.tarih, 
      g.vakit, 
      getMuezzinName(g.uid), 
      g.retSebebi || 'Belirtilmedi'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mazeret-gecmisi-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-600"></div>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">LOG KAYITLARI SIRALANIYOR</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 pb-8 border-b border-slate-200">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none lowercase italic text-left">
            MAZERET<span className="text-indigo-600 italic">LOGLARI</span>
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-400 mt-3">HİZMET AKIŞI VE PERSONEL MAZERET ARŞİVİ</p>
        </div>
        
        <motion.button 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={exportCSV} 
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white hover:bg-emerald-600 px-6 py-4 rounded-2xl shadow-xl shadow-slate-900/10 transition-all border border-slate-800"
        >
          <FileDown size={16} />
          VERİYİ DIŞA AKTAR
        </motion.button>
      </header>

      <section className="bg-white/70 backdrop-blur-2xl rounded-[24px] border border-slate-200/60 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center border border-slate-200/50"><Filter size={20} /></div>
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Görevli Bazlı Log Sorgulama</label>
            <div className="relative">
              <select 
                value={selectedMuezzin} 
                onChange={e => setSelectedMuezzin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 transition-all appearance-none cursor-pointer shadow-inner"
              >
                <option value="all">TÜM KADRO LİSTESİ</option>
                {muezzinler.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName.toUpperCase()}</option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Filter size={14} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-white/70 backdrop-blur-2xl rounded-[24px] border border-slate-200/60 overflow-hidden shadow-sm mt-12">
        {/* Desktop Table (High Visibility) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="px-8 py-4">TARİH & VAKİT</th>
                <th className="px-8 py-4">GÖREVLİ PERSONEL</th>
                <th className="px-8 py-4">MAZERET DETAYI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <td colSpan={3} className="p-20 text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Kayıt Bulunmuyor</td>
                  </motion.tr>
                ) : filtered.map((g, idx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: idx * 0.03 }}
                    key={g.id} 
                    className="group hover:bg-slate-50/40 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 tracking-tight">
                           {g.tarih ? format(parseISO(g.tarih), 'dd MMMM yyyy', { locale: tr }) : '-'}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">
                           {g.tarih ? format(parseISO(g.tarih), 'EEEE', { locale: tr }) : ''} • {g.vakit.toUpperCase()} VAKTİ
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <User size={14} />
                          </div>
                          <span className="text-sm font-bold text-slate-700 tracking-tight">{getMuezzinName(g.uid)}</span>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-block border border-slate-200">
                          {g.retSebebi || 'BELIRTILMEDI'}
                       </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-slate-100">
           {filtered.length === 0 ? (
             <div className="p-12 text-center text-slate-300 font-bold uppercase tracking-widest text-[11px] italic">Kayıt bulunmuyor.</div>
           ) : filtered.map(g => (
             <motion.div 
               layout
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               key={g.id} 
               className="p-6 space-y-4 bg-white"
             >
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                         {g.tarih ? format(parseISO(g.tarih), 'dd MMM yyyy', { locale: tr }) : '-'}
                      </h3>
                      <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mt-1">{g.vakit} VAKTİ</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-900 tracking-tight">{getMuezzinName(g.uid)}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">PERSONEL</p>
                   </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-0.5">MAZERET GEREKÇESİ</p>
                   <p className="text-[12px] font-medium text-slate-600 leading-relaxed">"{g.retSebebi || 'Sebep belirtilmedi.'}"</p>
                </div>
             </motion.div>
           ))}
        </div>
      </div>
    </div>
  );
}
