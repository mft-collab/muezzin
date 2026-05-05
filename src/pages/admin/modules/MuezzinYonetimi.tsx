import React, { useState, useEffect } from 'react';
import { useMuezzinler } from '../../../hooks/admin/useMuezzinler';
import { Muezzin, Invite } from '../../../types';
import { db } from '../../../lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { 
  Edit2, 
  Power, 
  Trash2, 
  AlertCircle, 
  UserPlus, 
  CheckCircle2, 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GUNLER_TR } from '../../../lib/dateUtils';
import { formatName } from '../../../lib/stringUtils';

export default function MuezzinYonetimi() {
  const { muezzinler, loading } = useMuezzinler();
  const [invites, setInvites] = useState<(Invite & { id: string })[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'invites'), (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }) as (Invite & { id: string })));
    }, (error: any) => {
      console.error("Firestore Dinleme Hatası:", error.message);
      if (error.code === 'permission-denied') {
          setErrorStatus("Davetiyeleri görme yetkiniz yok.");
      } else {
        handleFirestoreError(error, OperationType.GET, 'invites');
      }
    });
    return () => unsub();
  }, []);

  // Confirmation Modal States
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, data: (Muezzin & { id: string }) | null }>({ open: false, data: null });
  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean, data: (Muezzin & { id: string }) | null }>({ open: false, data: null });

  const [formData, setFormData] = useState({
    email: '',
    ad: '',
    soyad: '',
    role: 'muezzin' as 'muezzin' | 'admin' | 'gozlemci',
    haftalikIzinGunu: 0
  });

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorStatus(null);
      if (editingId) {
        await updateDoc(doc(db, 'muezzins', editingId), {
          displayName: `${formatName(formData.ad)} ${formatName(formData.soyad)}`.trim(),
          role: formData.role,
          haftalikIzinGunu: formData.haftalikIzinGunu
        });
      } else {
        const mail = formData.email.trim().toLowerCase();
        if (!mail || !mail.includes('@')) {
          setErrorStatus('Geçerli bir e-posta adresi giriniz.');
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
      setModalOpen(false);
    } catch (err) {
      setErrorStatus('Kayıt sırasında bir hata oluştu. Yetkiniz olmayabilir.');
    }
  };

  const openNew = () => {
    setErrorStatus(null);
    setEditingId(null);
    setFormData({ email: '', ad: '', soyad: '', role: 'muezzin', haftalikIzinGunu: 0 });
    setModalOpen(true);
  };

  const openEdit = (m: Muezzin & { id: string }) => {
    setErrorStatus(null);
    setEditingId(m.id);
    const parts = (m.displayName || '').split(' ');
    const soyad = parts.length > 1 ? parts.pop() || '' : '';
    const ad = parts.join(' ');
    setFormData({ 
      email: m.email || '', 
      ad, 
      soyad, 
      role: m.role,
      haftalikIzinGunu: m.haftalikIzinGunu || 0
    });
    setModalOpen(true);
  };

  const executeToggleAktif = async () => {
    const m = confirmToggle.data;
    if (!m) return;
    try {
      await updateDoc(doc(db, 'muezzins', m.id), {
        aktif: !m.aktif,
        onayBekliyor: false
      });
      setConfirmToggle({ open: false, data: null });
    } catch (err) {
      setErrorStatus('Personel durumu güncellenemedi.');
      setConfirmToggle({ open: false, data: null });
    }
  };

  const handleApprove = async (m: Muezzin & { id: string }) => {
    try {
      await updateDoc(doc(db, 'muezzins', m.id), {
        aktif: true,
        onayBekliyor: false
      });
    } catch (err) {
      setErrorStatus('Onay işlemi sırasında bir hata oluştu.');
    }
  };

  const executeDelete = async () => {
    const m = confirmDelete.data;
    if (!m) return;
    try {
      await deleteDoc(doc(db, 'muezzins', m.id));
      setConfirmDelete({ open: false, data: null });
    } catch (err) {
      setErrorStatus('Kullanıcı kaydı silinemedi.');
      setConfirmDelete({ open: false, data: null });
    }
  };

  const executeDeleteInvite = async (inviteEmail: string) => {
    try {
      await deleteDoc(doc(db, 'invites', inviteEmail));
    } catch (err) {
      setErrorStatus('Davet silinemedi.');
    }
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-indigo-600"></div>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">KADRO VERİLERİ YÜKLENİYOR</p>
      </div>
    </div>
  );

  const pendingUsers = [...muezzinler.filter(m => (m as any).onayBekliyor), ...invites.map(i => ({ ...i, isOnay: false, isInvite: true } as any))];
  const activeUsers = muezzinler.filter(m => !(m as any).onayBekliyor);

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 pb-8 border-b border-slate-200">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none lowercase italic text-left">
            KADRO<span className="text-indigo-600 italic">PORTFÖYÜ</span>
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-slate-400 mt-3">GÖREVLİ YETKİLENDİRME VE KİMLİK DENETİM MERKEZİ</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={openNew} 
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all border border-slate-800"
        >
          <UserPlus size={16} /> YENİ GÖREVLİ TANIMLA
        </motion.button>
      </header>

      {/* Bekleyen Davetler ve Onaylar */}
      {pendingUsers.length > 0 && (
        <section className="bg-rose-50 border border-rose-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
                <AlertCircle size={16} />
             </div>
             <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">BEKLEYEN DAVETLER</h2>
                <p className="text-[9px] text-rose-500 font-bold uppercase tracking-[0.2em] mt-0.5">PERSONELİN SİSTEME GİRİŞ YAPMASI BEKLENİYOR</p>
             </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingUsers.map(m => (
              <motion.div 
                layout
                key={m.id} 
                className="flex items-center justify-between p-4 bg-white border border-rose-100/50 rounded-xl group hover:border-rose-300 transition-colors shadow-sm"
              >
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center font-bold text-base border border-slate-100">
                       {m.displayName.charAt(0)}
                    </div>
                    <div>
                       <p className="text-sm font-bold text-slate-900 tracking-tight">{m.displayName}</p>
                       <p className="text-[10px] text-slate-400 font-bold lowercase tracking-wider mt-0.5">{(m as any).email || 'eposta yok'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    {!(m as any).isInvite ? (
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleApprove(m)}
                        className="p-2.5 bg-emerald-600 text-white rounded-lg shadow-md shadow-emerald-900/20 hover:bg-emerald-500 transition-colors"
                      >
                        <CheckCircle2 size={16} />
                      </motion.button>
                    ) : (
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100 text-center leading-tight">
                        ONAY<br/>BEKLENİYOR
                      </span>
                    )}
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => (m as any).isInvite ? executeDeleteInvite(m.id) : setConfirmDelete({ open: true, data: m })}
                      className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-all shadow-sm"
                      title="Daveti İptal Et / Sil"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                 </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Ana Liste */}
      <section className="bg-white/40 backdrop-blur-3xl rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="px-6 py-4">GÖREVLİ PROFİLİ</th>
                <th className="px-6 py-4">YETKİ</th>
                <th className="px-6 py-4 text-center">SABİT İZİN</th>
                <th className="px-6 py-4 text-center">AYLIK VAKİT</th>
                <th className="px-6 py-4 text-center">DURUM</th>
                <th className="px-6 py-4 text-right">EYLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-900">
              {activeUsers.map(m => (
                <tr key={m.id} className="group hover:bg-slate-50/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs shadow-inner">
                          {m.displayName.charAt(0)}
                       </div>
                       <div>
                          <p className="text-sm font-medium text-slate-900">{m.displayName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-1 h-1 rounded-full ${m.fcmToken ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">
                              {m.fcmToken ? 'Uygulama Bağlı' : 'Bağlantı Yok'}
                            </p>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border ${
                      m.role === 'admin' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                      {m.role === 'admin' ? 'YÖNETİCİ' : 'MÜEZZİN'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {m.haftalikIzinGunu && m.haftalikIzinGunu > 0 ? (
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase border border-indigo-100">
                        {GUNLER_TR[m.haftalikIzinGunu]}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-slate-300 uppercase tracking-tighter italic">---</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-semibold text-slate-700 tabular-nums">{m.aylikVakitSayisi || 0}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                       <div className={`flex items-center gap-2 px-2 py-1 rounded-full border ${m.aktif ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          <div className={`w-1 h-1 rounded-full ${m.aktif ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className="text-[9px] font-bold uppercase">{m.aktif ? 'AKTİF' : 'PASİF'}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 text-slate-400 group-hover:text-slate-600">
                      <button 
                        onClick={() => openEdit(m)} 
                        className="p-2 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => setConfirmToggle({ open: true, data: m })} 
                        className={`p-2 rounded-lg transition-all ${m.aktif ? 'hover:text-rose-600 hover:bg-rose-50' : 'hover:text-emerald-600 hover:bg-emerald-50'}`}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AnimatePresence>
        {errorStatus && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-medium uppercase tracking-widest mt-8"
          >
            <AlertCircle size={16} />
            {errorStatus}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "PROFİL GÜNCELLEME" : "YENİ GÖREVLİ TANIMI"}>
        <form onSubmit={handleCreateOrUpdate} className="space-y-8 p-2">
          <div className="group space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">E-POSTA ADRESİ</label>
            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!!editingId} className={`w-full border border-slate-200 bg-slate-50 p-5 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${editingId ? 'opacity-60 cursor-not-allowed' : ''}`} placeholder="Kurumsal e-posta hesabı..." />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="group space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">AD</label>
              <input type="text" required value={formData.ad} onChange={e => setFormData({...formData, ad: formatName(e.target.value)})} onBlur={e => setFormData({...formData, ad: formatName(e.target.value)})} className="w-full border border-slate-200 bg-slate-50 p-5 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="İsim..." />
            </div>
            <div className="group space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">SOYAD</label>
              <input type="text" required value={formData.soyad} onChange={e => setFormData({...formData, soyad: formatName(e.target.value)})} onBlur={e => setFormData({...formData, soyad: formatName(e.target.value)})} className="w-full border border-slate-200 bg-slate-50 p-5 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Soyisim..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">YETKİ KADEMESİ</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as 'admin'|'muezzin'|'gozlemci'})} className="w-full border border-slate-200 bg-slate-50 p-5 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer">
                <option value="muezzin">MÜEZZİN</option>
                <option value="gozlemci">GÖZLEMCİ</option>
                <option value="admin">YÖNETİCİ</option>
              </select>
            </div>
            <div className="group space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">SABİT HAFTALIK İZİN GÜNÜ</label>
              <select value={formData.haftalikIzinGunu} onChange={e => setFormData({...formData, haftalikIzinGunu: Number(e.target.value)})} className="w-full border border-slate-200 bg-slate-50 p-5 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer">
                <option value={0}>YOK</option>
                <option value={1}>PAZARTESİ</option>
                <option value={2}>SALI</option>
                <option value={3}>ÇARŞAMBA</option>
                <option value={4}>PERŞEMBE</option>
                <option value={5}>CUMA</option>
                <option value={6}>CUMARTESİ</option>
                <option value={7}>PAZAR</option>
              </select>
            </div>
          </div>
          <div className="pt-8 flex flex-col sm:flex-row gap-4">
            <button type="submit" className="flex-1 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest py-5 px-4 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-indigo-600 transition-all active:scale-95">
              BİLGİLERİ GÜVENLE KAYDET
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl hover:text-slate-900 transition-all">
              İPTAL
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, data: null })}
        onConfirm={executeDelete}
        title="Kullanıcıyı Sil"
        message={`${confirmDelete.data?.displayName} adlı kullanıcının tüm verilerini silmek istiyor musunuz? Bu işlem geri alınamaz.`}
        isDanger={true}
        confirmText="Evet, Kalıcı Olarak Sil"
      />

      <ConfirmModal 
        isOpen={confirmToggle.open}
        onClose={() => setConfirmToggle({ open: false, data: null })}
        onConfirm={executeToggleAktif}
        title={confirmToggle.data?.aktif ? "Personeli Pasife Al" : "Personeli Aktifleştir"}
        message={confirmToggle.data?.aktif 
          ? `${confirmToggle.data?.displayName} adlı personeli pasife almak istiyor musunuz? Pasif personel planlara dahil edilmez.`
          : `${confirmToggle.data?.displayName} adlı personeli aktifleştirmek istiyor musunuz?`
        }
        isDanger={confirmToggle.data?.aktif}
        confirmText="Devam Et"
      />
    </div>
  );
}
