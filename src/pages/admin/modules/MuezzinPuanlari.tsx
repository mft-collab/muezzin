import React, { useState } from 'react';
import { useMuezzinler } from '../../../hooks/admin/useMuezzinler';
import { db } from '../../../lib/firebase';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Edit3, Check, Trophy, RotateCcw, User, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function MuezzinPuanlari() {
  const { muezzinler, loading } = useMuezzinler();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const siralnMuezzinler = [...muezzinler].sort((a, b) => (b.aylikVakitSayisi || 0) - (a.aylikVakitSayisi || 0));

  const startEdit = (id: string, currentVal: number) => {
    setEditingId(id);
    setEditValue(String(currentVal || 0));
  };

  const saveEdit = async (id: string) => {
    try {
      const val = parseInt(editValue, 10);
      if (isNaN(val)) return;
      setErrorStatus(null);
      await updateDoc(doc(db, 'muezzins', id), { aylikVakitSayisi: val });
      setEditingId(null);
    } catch (err) {
      setErrorStatus("İşlem sırasında bir hata oluştu.");
    }
  };

  const handleManualReset = async () => {
    try {
      setErrorStatus(null);
      const batch = writeBatch(db);
      muezzinler.filter(m => m.aktif).forEach(m => {
        batch.update(doc(db, 'muezzins', m.id), { aylikVakitSayisi: 0 });
      });
      await batch.commit();
      setConfirmOpen(false);
    } catch (err) {
      setErrorStatus("Sıfırlama başarısız oldu.");
      setConfirmOpen(false);
    }
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-600"></div>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">İSTATİSTİKLER ANALİZ EDİLİYOR</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 pb-8 border-b border-slate-200">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none lowercase italic text-left">
            PERFORMANS<span className="text-indigo-600 italic">ARŞİVİ</span>
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-400 mt-3">LİYAKAT VE KURUMSAL VERİMLİLİK ANALİZ MERKEZİ</p>
        </div>
        
        <motion.button 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white hover:bg-rose-600 px-6 py-4 rounded-2xl shadow-xl shadow-slate-900/10 transition-all border border-slate-800 group"
        >
          <RotateCcw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
          PERİODİK SIFIRLAMA
        </motion.button>
      </header>

      <AnimatePresence>
        {errorStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50/50 backdrop-blur-sm border border-red-100 p-6 rounded-[24px] flex items-center gap-3 text-red-600 text-[10px] font-medium uppercase tracking-widest mb-8"
          >
            <AlertCircle size={16} strokeWidth={1.5} />
            {errorStatus}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white/70 backdrop-blur-2xl rounded-[24px] border border-slate-200/60 overflow-hidden shadow-sm">
        {/* Desktop View (Vibrant) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="px-8 py-4 text-center w-24">SIRALAMA</th>
                <th className="px-8 py-4">GÖREVLİ</th>
                <th className="px-8 py-4 text-center">TOPLAM VAKİT</th>
                <th className="px-8 py-4 text-right">EFOR SKORU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-900">
              <AnimatePresence mode="popLayout">
                {siralnMuezzinler.map((m, index) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    key={m.id} 
                    className="group hover:bg-slate-50/40 transition-colors"
                  >
                    <td className="px-8 py-5 text-center">
                      <div className="flex items-center justify-center">
                        {index === 0 ? (
                          <div className="w-8 h-8 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-lg shadow-slate-950/20">
                             <Trophy size={14} />
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-300">#{index + 1}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shadow-inner">
                          {m.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 tracking-tight">{m.displayName}</p>
                          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">KADROLU PERSONEL</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        {editingId === m.id ? (
                          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                            <input 
                              type="number" 
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => saveEdit(m.id)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit(m.id)}
                              className="w-16 bg-transparent border-none text-center text-sm font-bold outline-none"
                            />
                            <button onClick={() => saveEdit(m.id)} className="p-1.5 bg-slate-950 text-white rounded-md">
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => startEdit(m.id, m.aylikVakitSayisi || 0)}
                            className="group/val cursor-pointer flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all font-sans"
                          >
                            <span className="text-2xl font-bold tracking-tighter text-slate-900">
                              {m.aylikVakitSayisi || 0}
                            </span>
                            <Edit3 size={12} className="text-slate-300 opacity-0 group-hover/val:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <span className={`text-[10px] font-bold tracking-widest px-3 py-1 rounded-full ${
                         (m.aylikVakitSayisi || 0) > 30 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'
                       }`}>
                          %{Math.min(100, (m.aylikVakitSayisi || 0) * 2)} VERİMLİLİK
                       </span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
           {siralnMuezzinler.map((m, index) => (
             <motion.div 
               layout
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               key={m.id} 
               className="p-6 flex items-center justify-between group bg-white"
             >
                <div className="flex items-center gap-4">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs border ${
                     index === 0 ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10' : 
                     index === 1 ? 'bg-slate-100 text-slate-500 border-slate-200' :
                     index === 2 ? 'bg-slate-50 text-slate-400 border-slate-100' :
                     'text-slate-300 border-slate-50'
                   }`}>
                      {index + 1}
                   </div>
                   <div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-1">{m.displayName}</h3>
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${m.aktif ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                         {m.aktif ? 'GÖREVDE' : 'PASİF'}
                      </span>
                   </div>
                </div>

                <div className="flex items-center gap-4">
                   {editingId === m.id ? (
                      <div className="flex items-center gap-2">
                         <input 
                           type="number" 
                           value={editValue} 
                           onChange={e => setEditValue(e.target.value)} 
                           className="w-16 bg-slate-50 p-2 rounded-xl text-right font-bold text-lg text-slate-900 focus:outline-none border border-slate-200"
                           autoFocus
                         />
                         <button onClick={() => saveEdit(m.id)} className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-transform">
                            <Check size={14} />
                         </button>
                      </div>
                   ) : (
                      <div className="flex flex-col items-end gap-1" onClick={() => startEdit(m.id, m.aylikVakitSayisi || 0)}>
                         <span className="font-bold text-2xl text-slate-900 tracking-tighter italic">{m.aylikVakitSayisi || 0}</span>
                         <span className="text-[8px] font-bold uppercase tracking-widest text-slate-300">VAKİT PUANI</span>
                      </div>
                   )}
                </div>
             </motion.div>
           ))}
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleManualReset}
        title="Puanları Sıfırla"
        message="Tüm müezzinlerin aylık görev puanlarını sıfırlamak istiyor musunuz? Bu işlem geri alınamaz."
        isDanger={true}
        confirmText="Evet, Sıfırla"
      />
    </div>
  );
}
