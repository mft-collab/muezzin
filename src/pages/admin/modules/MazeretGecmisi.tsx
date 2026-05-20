import React, { useState } from 'react';
import { useMazeretGecmisi } from '../../../hooks/admin/useMazeretGecmisi';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { FileDown, Filter, User } from 'lucide-react';

export default function MazeretGecmisi() {
  const { gecmis, loading } = useMazeretGecmisi();
  const muezzinler = useMuezzinStore(s => s.muezzinler);
  const muezzinMap = useMuezzinStore(s => s.muezzinMap);
  
  const [selectedMuezzin, setSelectedMuezzin] = useState<string>('all');

  const getMuezzinName = (uid: string) => {
    return muezzinMap[uid]?.displayName || 'Bilinmiyor';
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
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-lg" />
        <p className="authority-title !text-[9px] opacity-30 tracking-[0.4em]">ARŞİV KAYITLARI SENKRONİZE EDİLİYOR</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* TOOLBAR: Operational Intelligence */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Mazeret Arşivi</h2>
           <p className="authority-title !text-[7px] opacity-30 font-medium tracking-[0.2em]">{filtered.length} TOPLAM KAYIT LİSTELENDİ</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex-1 md:w-64 relative group">
            <select 
              value={selectedMuezzin} 
              onChange={e => setSelectedMuezzin(e.target.value)}
              className="w-full spatial-glass-elevated py-3.5 px-6 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-primary)] outline-none border border-white/5 hover:bg-white/[0.05] focus:border-indigo-500/30 transition-all appearance-none cursor-pointer"
            >
              <option value="all" className="bg-[#0a0a0a]">TÜM PERSONEL</option>
              {muezzinler.map(m => (
                <option key={m.id} value={m.id} className="bg-[#0a0a0a]">{m.displayName.toUpperCase()}</option>
              ))}
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
               <Filter size={14} />
            </div>
          </div>

          <motion.button 
            whileHover={{ y: -3, scale: 1.02, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
            whileTap={{ scale: 0.98 }}
            onClick={exportCSV}
            className="flex items-center gap-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-6 py-3.5 rounded-2xl text-[9px] font-bold uppercase tracking-[0.3em] shadow-lg transition-all"
          >
            <FileDown size={14} />
            DIŞA AKTAR
          </motion.button>
        </div>
      </div>

      {/* TIMELINE TABLE: Chronological Context */}
      <section className="spatial-glass p-8 border border-white/5 relative overflow-hidden min-h-[400px]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent" />
        
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-separate border-spacing-y-4">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-6 pb-4 authority-title !text-[7px] opacity-30 font-bold tracking-[0.3em]">ZAMAN DAMGASI</th>
                <th className="px-6 pb-4 authority-title !text-[7px] opacity-30 font-bold tracking-[0.3em]">PERSONEL</th>
                <th className="px-6 pb-4 authority-title !text-[7px] opacity-30 font-bold tracking-[0.3em]">MAZERET GEREKÇESİ</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <td colSpan={3} className="py-32 authority-title !text-[9px] opacity-20 tracking-[0.4em] italic uppercase">Arşivde kayıt bulunmuyor</td>
                  </motion.tr>
                ) : filtered.map((g, idx) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30, delay: idx * 0.03 }}
                    key={g.id} 
                    className="group"
                  >
                    <td className="px-6 py-5 spatial-glass-elevated !rounded-l-[24px] border-r-0">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-[var(--text-primary)] tracking-tight">
                           {g.tarih ? format(parseISO(g.tarih), 'dd MMMM yyyy', { locale: tr }) : '-'}
                        </span>
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                           <span className="authority-title !text-[7px] opacity-40 uppercase tracking-[0.2em]">
                              {g.tarih ? format(parseISO(g.tarih), 'EEEE', { locale: tr }) : ''} • {g.vakit.toUpperCase()} VAKTİ
                           </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 spatial-glass-elevated border-x-0">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-[14px] bg-white/[0.03] border border-white/5 flex items-center justify-center text-indigo-400 font-light text-lg shadow-lg">
                             {getMuezzinName(g.uid).charAt(0)}
                          </div>
                          <span className="text-sm font-light text-[var(--text-primary)] tracking-tight">{getMuezzinName(g.uid)}</span>
                       </div>
                    </td>
                    <td className="px-6 py-5 spatial-glass-elevated !rounded-r-[24px] border-l-0">
                       <div className="bg-indigo-500/10 border border-indigo-500/20 px-5 py-2.5 rounded-xl inline-flex items-center gap-3 shadow-sm group-hover:bg-indigo-500/15 transition-all duration-500">
                          <div className="w-1 h-1 rounded-full bg-indigo-500" />
                          <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-widest leading-none">
                            {g.retSebebi || 'SEBEP BELİRTİLMEDİ'}
                          </span>
                       </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* MOBILE ARCHIVE CARDS (Fallback) */}
        <div className="md:hidden flex flex-col gap-4 mt-6">
           {filtered.map((g, idx) => (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: idx * 0.05 }}
               key={g.id} 
               className="spatial-glass-elevated p-6 space-y-6"
             >
                <div className="flex justify-between items-start">
                   <div className="flex flex-col gap-1.5">
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">
                         {g.tarih ? format(parseISO(g.tarih), 'dd MMM yyyy', { locale: tr }) : '-'}
                      </h3>
                      <p className="authority-title !text-[7px] text-indigo-400 font-bold uppercase tracking-widest">{g.vakit} VAKTİ</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-[var(--text-primary)]">{getMuezzinName(g.uid)}</p>
                      <p className="authority-title !text-[6px] opacity-30 uppercase tracking-widest mt-1">OPERASYONEL PERSONEL</p>
                   </div>
                </div>
                <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/5 relative overflow-hidden">
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/40" />
                   <p className="authority-title !text-[6px] opacity-20 uppercase tracking-[0.3em] mb-2">MAZERET GEREKÇESİ</p>
                   <p className="text-[11px] font-light text-[var(--text-primary)]/80 leading-relaxed italic">"{g.retSebebi || 'Sebep belirtilmedi.'}"</p>
                </div>
             </motion.div>
           ))}
        </div>
      </section>
    </div>
  );
}
