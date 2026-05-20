import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Modal } from '../../../components/ui/Modal';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { formatName } from '../../../lib/stringUtils';
import { Muezzin } from '../../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingUser: (Muezzin & { id: string }) | null;
}

export const PersonelFormModal = React.memo(({ isOpen, onClose, editingUser }: Props) => {
  const [formData, setFormData] = useState({
    email: '', ad: '', soyad: '', role: 'muezzin' as 'muezzin'|'admin'|'gozlemci', haftalikIzinGunu: 0
  });
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorStatus(null);
      if (editingUser) {
        const parts = (editingUser.displayName || '').split(' ');
        const soyad = parts.length > 1 ? parts.pop() || '' : '';
        const ad = parts.join(' ');
        setFormData({
          email: editingUser.email || '',
          ad, soyad,
          role: editingUser.role,
          haftalikIzinGunu: editingUser.haftalikIzinGunu || 0
        });
      } else {
        setFormData({ email: '', ad: '', soyad: '', role: 'muezzin', haftalikIzinGunu: 0 });
      }
    }
  }, [isOpen, editingUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      setErrorStatus(null);
      if (editingUser) {
        await updateDoc(doc(db, 'muezzins', editingUser.id), {
          displayName: `${formatName(formData.ad)} ${formatName(formData.soyad)}`.trim(),
          role: formData.role,
          haftalikIzinGunu: formData.haftalikIzinGunu
        });
      } else {
        const mail = formData.email.trim().toLowerCase();
        if (!mail || !mail.includes('@')) {
          setErrorStatus('Geçerli bir e-posta adresi giriniz.');
          setIsSubmitting(false);
          return;
        }
        await setDoc(doc(db, 'invites', mail), {
          email: mail,
          displayName: `${formatName(formData.ad)} ${formatName(formData.soyad)}`.trim(),
          role: formData.role,
          haftalikIzinGunu: formData.haftalikIzinGunu,
          olusturmaTarihi: Timestamp.now()
        });
      }
      onClose();
    } catch (err) {
      setErrorStatus('Kayıt sırasında bir hata oluştu. Yetkiniz olmayabilir.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={editingUser ? "PROFİL GÜNCELLEME" : "YENİ PERSONEL TANIMI"}>
        <form onSubmit={handleSubmit} className="space-y-8 py-4">
            <div className="space-y-4 group">
              <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em] group-hover:opacity-100 group-hover:font-black transition-all duration-700">ERİŞİM E-POSTASI</label>
              <input 
                type="email" 
                required 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})} 
                disabled={!!editingUser || isSubmitting} 
                className={`w-full spatial-glass-elevated p-6 rounded-3xl text-sm font-light text-[var(--text-primary)] border border-white/5 outline-none transition-all duration-700 ${editingUser ? 'opacity-30 cursor-not-allowed' : 'focus:border-indigo-500/30 focus:bg-white/[0.05] focus:shadow-[0_0_30px_rgba(99,102,241,0.1)]'}`} 
                placeholder="kurumsal@muezzin.app" 
              />
            </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em]">PERSONEL ADI</label>
              <input 
                type="text" 
                required 
                value={formData.ad} 
                onChange={e => setFormData({...formData, ad: formatName(e.target.value)})} 
                disabled={isSubmitting}
                className="w-full spatial-glass-elevated p-5 rounded-2xl text-sm font-light text-[var(--text-primary)] border border-white/5 outline-none focus:border-indigo-500/30 transition-all duration-700" 
                placeholder="Örn: Ahmet" 
              />
            </div>
            <div className="space-y-3">
              <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em]">SOYADI</label>
              <input 
                type="text" 
                required 
                value={formData.soyad} 
                onChange={e => setFormData({...formData, soyad: formatName(e.target.value)})} 
                disabled={isSubmitting}
                className="w-full spatial-glass-elevated p-5 rounded-2xl text-sm font-light text-[var(--text-primary)] border border-white/5 outline-none focus:border-indigo-500/30 transition-all duration-700" 
                placeholder="Örn: Yılmaz" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 md:col-span-1 space-y-4 group">
              <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em] group-hover:opacity-100 group-hover:font-black transition-all duration-700">YETKİ SEVİYESİ</label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { value: 'muezzin', label: 'MÜEZZİN', desc: 'Görevli Kadro' },
                  { value: 'gozlemci', label: 'GÖZLEMCİ', desc: 'Sadece İzleyici' },
                  { value: 'admin', label: 'YÖNETİCİ', desc: 'Tam Yetkili' }
                ].map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setFormData({ ...formData, role: role.value as any })}
                    className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all border outline-none ${
                      formData.role === role.value
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_10px_20px_rgba(99,102,241,0.25)]'
                        : 'bg-white/[0.02] text-white/20 border-white/5 hover:border-white/10 focus:border-white/10'
                    }`}
                  >
                    <span className="text-[8px] font-black uppercase tracking-wider">{role.label}</span>
                    <span className="text-[6px] mt-1 opacity-45 block leading-normal">{role.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2 md:col-span-1 space-y-4">
              <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em]">HAFTALIK İZİN GÜNÜ</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 0, label: 'İZİNSİZ' },
                  { value: 1, label: 'PZT' },
                  { value: 2, label: 'SAL' },
                  { value: 3, label: 'ÇAR' },
                  { value: 4, label: 'PER' },
                  { value: 5, label: 'CUM', disabled: true },
                  { value: 6, label: 'CMT' },
                  { value: 7, label: 'PAZ' }
                ].map((day) => {
                  const isSelected = formData.haftalikIzinGunu === day.value;
                  return (
                    <button
                      key={day.value}
                      type="button"
                      disabled={day.disabled || isSubmitting}
                      onClick={() => setFormData({ ...formData, haftalikIzinGunu: day.value })}
                      className={`px-3 py-2.5 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all border outline-none ${
                        day.disabled
                          ? 'opacity-10 cursor-not-allowed border-transparent bg-transparent'
                          : isSelected
                            ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_8px_16px_rgba(99,102,241,0.25)]'
                            : 'bg-white/[0.02] text-white/40 border-white/5 hover:border-white/10 focus:border-white/10'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-10 flex items-center gap-6">
            <motion.button 
              whileHover={{ y: -3, scale: 1.01, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-[0.3em] py-5 rounded-2xl shadow-lg transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'İŞLENİYOR...' : (editingUser ? 'PROFİLİ GÜNCELLE' : 'PERSONELİ SİSTEME EKLE')}
            </motion.button>
            <motion.button 
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.95 }}
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all border border-white/5 rounded-2xl"
            >
              İPTAL
            </motion.button>
          </div>
        </form>
      </Modal>
      
      <AnimatePresence>
        {errorStatus && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 right-6 z-50 spatial-glass !bg-rose-500/10 border-rose-500/30 p-5 flex items-center gap-4 text-rose-500 text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl rounded-2xl"
          >
            <AlertCircle size={20} />
            {errorStatus}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
