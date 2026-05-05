import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Duyuru } from '../../../hooks/useDuyurular';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Info, 
  Bell,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export const DuyuruYonetimi: React.FC = () => {
  const [duyurular, setDuyurular] = useState<Duyuru[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    baslik: '',
    icerik: '',
    tip: 'duyuru' as Duyuru['tip']
  });

  useEffect(() => {
    const q = query(collection(db, 'duyurular'), orderBy('tarih', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Duyuru[];
      setDuyurular(data);
      setLoading(false);
    }, (error) => {
      import('../../../lib/firestore-errors').then(({ handleFirestoreError, OperationType }) => {
        handleFirestoreError(error, OperationType.LIST, 'duyurular');
      });
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'duyurular'), {
        ...formData,
        tarih: Timestamp.now()
      });
      setModalOpen(false);
      setFormData({ baslik: '', icerik: '', tip: 'duyuru' });
    } catch (error) {
      console.error('Duyuru eklenemedi:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'duyurular', id));
      } catch (error) {
        console.error('Duyuru silinemedi:', error);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Megaphone className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">DUYURU YÖNETİMİ</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kurumsal Bilgilendirme Sistemi</p>
          </div>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="bg-indigo-600 text-white p-4 rounded-2xl flex items-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform" />
          <span className="text-[11px] font-bold uppercase tracking-widest hidden sm:inline">Yeni Duyuru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {duyurular.map((duyuru) => (
            <motion.div
              key={duyuru.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all relative group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${
                  duyuru.tip === 'onemli' ? 'bg-rose-50 text-rose-500' :
                  duyuru.tip === 'bilgi' ? 'bg-sky-50 text-sky-500' : 'bg-slate-50 text-slate-500'
                }`}>
                  {duyuru.tip === 'onemli' ? <AlertCircle size={16} /> :
                   duyuru.tip === 'bilgi' ? <Info size={16} /> : <Bell size={16} />}
                </div>
                <button 
                  onClick={() => handleDelete(duyuru.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-tight mb-1.5">{duyuru.baslik}</h3>
              <p className="text-[11px] font-medium text-slate-600 leading-relaxed mb-4 line-clamp-3">{duyuru.icerik}</p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {duyuru.tarih 
                    ? format(
                        typeof duyuru.tarih?.toDate === 'function' ? duyuru.tarih.toDate() : new Date(duyuru.tarih?.seconds ? duyuru.tarih.seconds * 1000 : duyuru.tarih), 
                        'd MMM yyyy', 
                        { locale: tr }
                      ) 
                    : ''}
                </span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${
                   duyuru.tip === 'onemli' ? 'bg-rose-100 text-rose-600' :
                   duyuru.tip === 'bilgi' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  {duyuru.tip}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">YENİ DUYURU</h3>
                <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">DUYURU BAŞLIĞI</label>
                  <input required value={formData.baslik} onChange={e => setFormData({...formData, baslik: e.target.value})} className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">İÇERİK</label>
                  <textarea required rows={4} value={formData.icerik} onChange={e => setFormData({...formData, icerik: e.target.value})} className="w-full border border-slate-200 bg-slate-50 p-4 rounded-xl text-sm font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">DUYURU TİPİ</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['onemli', 'bilgi', 'duyuru'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({...formData, tip: type as Duyuru['tip']})}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          formData.tip === type ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-indigo-600 transition-all">
                  DUYURUYU YAYINLA
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
