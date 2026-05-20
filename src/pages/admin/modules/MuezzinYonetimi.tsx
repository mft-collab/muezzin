import React, { useState, useEffect } from 'react';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { Muezzin, Invite } from '../../../types';
import { db } from '../../../lib/firebase';
import { doc, updateDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { PersonelFormModal } from '../components/PersonelFormModal';
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

export default function MuezzinYonetimi() {
  // ATOMIC ZUSTAND SELECTORS - (Engeller gereksiz renderları)
  const muezzinler = useMuezzinStore(state => state.muezzinler);
  const loading = useMuezzinStore(state => state.loading);

  const [invites, setInvites] = useState<(Invite & { id: string })[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<(Muezzin & { id: string }) | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'invites'), (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }) as (Invite & { id: string })));
    }, (error: import('firebase/firestore').FirestoreError) => {
      console.error("Firestore Dinleme Hatası:", error.message);
      if (error.code === 'permission-denied') {
          setErrorStatus("Davetiyeleri görme yetkiniz yok.");
      } else {
        handleFirestoreError(error, OperationType.GET, 'invites');
      }
    });
    return () => unsub();
  }, []);

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean, data: (Muezzin & { id: string }) | null }>({ open: false, data: null });
  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean, data: (Muezzin & { id: string }) | null }>({ open: false, data: null });

  const openNew = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEdit = (m: Muezzin & { id: string }) => {
    setEditingUser(m);
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
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-lg" />
        <p className="authority-title !text-[9px] opacity-30 tracking-[0.4em]">KADRO VERİLERİ SENKRONİZE EDİLİYOR</p>
      </div>
    </div>
  );

  const pendingUsers = React.useMemo(() => [
    ...muezzinler.filter(m => m && (m as any).onayBekliyor === true), 
    ...invites.map(i => ({ ...i, isOnay: false, isInvite: true } as any))
  ], [muezzinler, invites]);
  
  const activeUsers = React.useMemo(() => 
    muezzinler.filter(m => m && (m as any).onayBekliyor !== true)
  , [muezzinler]);

  // Performans Sıralaması ve Maksimum Vakit Hesabı (Memoized)
  const { maxVakit, sortedMuezzins } = React.useMemo(() => {
    const maxVal = Math.max(...activeUsers.map(x => x.aylikVakitSayisi || 0), 1);
    const sorted = [...activeUsers].sort((a, b) => (b.aylikVakitSayisi || 0) - (a.aylikVakitSayisi || 0));
    return { maxVakit: maxVal, sortedMuezzins: sorted };
  }, [activeUsers]);

  return (
    <div className="flex flex-col gap-10">
      {/* ACTION BAR: Executive Authority */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Kadro Operasyonları</h2>
           <p className="authority-title !text-[7px] opacity-30 font-medium tracking-[0.2em]">{muezzinler.length} TOPLAM PERSONEL TANIMLI</p>
        </div>
        <motion.button 
          whileHover={{ y: -3, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openNew} 
          className="px-8 py-4 bg-indigo-500 text-white rounded-2xl text-[9px] font-bold uppercase tracking-[0.3em] shadow-[0_15px_30px_rgba(99,102,241,0.25)] flex items-center gap-4 group"
        >
          <UserPlus size={16} className="group-hover:rotate-12 transition-transform" /> 
          YENİ PERSONEL TANIMLA
        </motion.button>
      </div>

      {/* PENDING ACTIONS: Spatial Context Alert */}
      {pendingUsers.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="spatial-glass p-8 !bg-rose-500/[0.03] border-rose-500/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex items-center gap-4 mb-8">
             <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shadow-lg border border-rose-500/20">
               <AlertCircle size={20} strokeWidth={1.5} />
             </div>
             <div>
                <h3 className="text-sm font-medium text-rose-500/80 tracking-tight">Bekleyen Onaylar & Davetler</h3>
                <p className="authority-title !text-[7px] opacity-40 mt-1 font-medium tracking-[0.2em]">SİSTEME ERİŞİM BEKLEYEN {pendingUsers.length} KAYIT VAR</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {pendingUsers.map((m, idx) => (
              <motion.div 
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={m.id} 
                className="spatial-glass-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 group hover:bg-white/[0.04] transition-all duration-500"
              >
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 font-light text-lg">
                       {m.displayName.charAt(0)}
                    </div>
                    <div>
                       <p className="text-sm font-light text-[var(--text-primary)] tracking-tight">{m.displayName}</p>
                       <p className="text-[7px] text-[var(--text-secondary)]/50 font-bold uppercase tracking-widest mt-1">{(m as any).email}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    {!(m as any).isInvite ? (
                      <motion.button 
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(16,185,129,0.15)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleApprove(m)}
                        className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 shadow-sm"
                      >
                        <CheckCircle2 size={16} />
                      </motion.button>
                    ) : (
                      <div className="px-3 py-1 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[6px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">DAVETLİ</span>
                      </div>
                    )}
                    <motion.button 
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(244,63,94,0.15)' }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => (m as any).isInvite ? executeDeleteInvite(m.id) : setConfirmDelete({ open: true, data: m })}
                      className="p-3 bg-white/5 text-[var(--text-secondary)]/30 rounded-xl border border-white/5 hover:text-rose-500 hover:border-rose-500/20 transition-all shadow-sm"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                 </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* MAIN PERSONNEL LIST: Living Card Grid */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-2 px-2">
           <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
              <h2 className="text-lg font-light tracking-tight text-[var(--text-primary)]">Operasyonel Kadro</h2>
           </div>
           <span className="premium-label !text-[9px] !opacity-20">{activeUsers.length} PERSONEL KAYITLI</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {activeUsers.length > 0 ? activeUsers.map((m, idx) => {
            const rank = sortedMuezzins.findIndex(x => x.id === m.id) + 1;
            const efficiency = Math.min(100, ((m.aylikVakitSayisi || 0) / maxVakit) * 100);

            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={m.id} 
                className="group relative p-6 spatial-glass border-[var(--glass-border)] rounded-[40px] overflow-hidden transition-all duration-700 hover:shadow-2xl hover:shadow-indigo-500/5"
              >
                {/* Left Status Pillar */}
                <div className={`absolute left-0 top-8 bottom-8 w-[4px] rounded-r-full transition-all duration-700 shadow-lg ${
                  m.aktif ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-rose-500 shadow-rose-500/40'
                }`} />

                <div className="relative z-10 flex flex-col gap-6">
                  {/* Header: Identity */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between items-start gap-4 sm:gap-0">
                    <div className="flex items-center gap-5">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-[24px] bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] flex items-center justify-center font-light text-2xl text-indigo-400 shadow-inner group-hover:scale-105 group-hover:rotate-3 transition-all duration-700 relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent z-0" />
                          {m.photoURL ? (
                            <img src={m.photoURL} alt={m.displayName} className="w-full h-full object-cover relative z-10" />
                          ) : (
                            <span className="relative z-10">{m.displayName.charAt(0)}</span>
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-[var(--app-bg)] shadow-xl ${
                          m.aktif ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`} />
                      </div>
                      <div>
                        <h4 className="text-xl font-light tracking-tight text-[var(--text-primary)] apple-thin group-hover:font-normal transition-all duration-500">
                          {m.displayName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="relative flex h-2 w-2">
                            {m.fcmToken && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${m.fcmToken ? 'bg-indigo-500' : 'bg-[var(--text-primary)]/10'}`} />
                          </div>
                          <span className={`text-[8px] font-bold tracking-[0.2em] uppercase transition-colors duration-500 ${
                            m.fcmToken ? 'text-indigo-400/80' : 'text-[var(--text-secondary)]/20'
                          }`}>
                            {m.fcmToken ? 'NETWORK ACTIVE' : 'OFFLINE MODE'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                      {rank === 1 && (
                        <span className="px-2 py-0.5 rounded-md text-[6px] font-black tracking-[0.1em] bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                          🏆 LİDER
                        </span>
                      )}
                      {rank === 2 && (
                        <span className="px-2 py-0.5 rounded-md text-[6px] font-black tracking-[0.1em] bg-slate-400/10 text-slate-400 border border-slate-400/20">
                          🥈 2. SIRADA
                        </span>
                      )}
                      {rank === 3 && (
                        <span className="px-2 py-0.5 rounded-md text-[6px] font-black tracking-[0.1em] bg-amber-700/10 text-amber-700 border border-amber-700/20">
                          🥉 3. SIRADA
                        </span>
                      )}
                      {rank > 3 && (
                        <span className="px-2 py-0.5 rounded-md text-[6px] font-bold tracking-[0.1em] bg-[var(--text-primary)]/[0.03] text-[var(--text-secondary)]/30 border border-[var(--glass-border)]">
                          #{rank} SIRALAMA
                        </span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-md text-[6px] font-bold tracking-[0.2em] uppercase border shadow-sm ${
                        m.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-[var(--text-primary)]/[0.02] text-[var(--text-secondary)]/50 border-[var(--glass-border)]'
                      }`}>
                        {m.role === 'admin' ? 'ADMIN' : 'MÜEZZİN'}
                      </span>
                    </div>
                  </div>

                  {/* Body: Stats Bento Grid */}
                  <div className="grid grid-cols-2 gap-4 p-5 bg-[var(--text-primary)]/[0.02] rounded-[28px] border border-[var(--glass-border)]">
                    <div className="space-y-1.5">
                      <p className="premium-label !text-[8px] !opacity-20 uppercase tracking-[0.15em]">İZİN GÜNÜ</p>
                      <p className="text-xs font-light text-[var(--text-primary)] tracking-wide">
                        {m.haftalikIzinGunu && m.haftalikIzinGunu > 0 ? GUNLER_TR[m.haftalikIzinGunu] : 'BELİRTİLMEMİŞ'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="premium-label !text-[8px] !opacity-20 uppercase tracking-[0.15em]">GÖREV YÜKÜ</p>
                      <p className="text-xs font-medium text-indigo-400 tabular-nums">
                        {m.aylikVakitSayisi || 0} Vakit
                      </p>
                    </div>
                    
                    {/* Full-width Relative Efficiency */}
                    <div className="col-span-2 space-y-2 border-t border-[var(--glass-border)] pt-3 mt-1">
                      <div className="flex justify-between items-center">
                        <p className="premium-label !text-[8px] !opacity-20 uppercase tracking-[0.15em]">OPERASYONEL VERİM</p>
                        <span className={`text-[9px] font-bold tabular-nums ${
                          efficiency > 80 ? 'text-amber-500' : efficiency > 40 ? 'text-emerald-500' : 'text-[var(--text-secondary)]/40'
                        }`}>
                          %{Math.round(efficiency)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--text-primary)]/[0.05] rounded-full overflow-hidden border border-[var(--glass-border)]">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${efficiency}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full ${
                            efficiency > 80 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 
                            efficiency > 40 ? 'bg-emerald-500/60' : 
                            'bg-[var(--text-primary)]/10'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer: Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-md text-[6px] font-bold tracking-[0.1em] border ${
                        m.aktif ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {m.aktif ? 'READY' : 'STANDBY'}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <motion.button 
                        whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-medium)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => openEdit(m)} 
                        className="p-3 bg-[var(--text-primary)]/[0.03] text-[var(--text-secondary)]/40 hover:text-[var(--text-primary)] rounded-[16px] border border-[var(--glass-border)] transition-all shadow-lg"
                      >
                        <Edit2 size={16} strokeWidth={1.5} />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1, backgroundColor: m.aktif ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setConfirmToggle({ open: true, data: m })} 
                        className={`p-3 bg-[var(--text-primary)]/[0.03] rounded-[16px] border border-[var(--glass-border)] transition-all shadow-lg ${
                          m.aktif ? 'text-rose-400 hover:border-rose-400/30' : 'text-emerald-400 hover:border-emerald-400/30'
                        }`}
                      >
                        <Power size={16} strokeWidth={1.5} />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(244,63,94,0.1)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setConfirmDelete({ open: true, data: m })} 
                        className="p-3 bg-[var(--text-primary)]/[0.03] text-[var(--text-secondary)]/40 hover:text-rose-500 rounded-[16px] border border-[var(--glass-border)] hover:border-rose-500/30 transition-all shadow-lg"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Card Decoration */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
              </motion.div>
            );
          }) : (
            <div className="col-span-full py-20 text-center spatial-glass border-dashed border-[var(--glass-border)]">
              <p className="premium-label !opacity-20 italic">SİSTEME KAYITLI PERSONEL BULUNAMADI</p>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {errorStatus && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="spatial-glass !bg-rose-500/10 border-rose-500/30 p-5 flex items-center gap-4 text-rose-500 text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl"
          >
            <AlertCircle size={20} />
            {errorStatus}
          </motion.div>
        )}
      </AnimatePresence>

      <PersonelFormModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        editingUser={editingUser} 
      />

      <ConfirmModal 
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, data: null })}
        onConfirm={executeDelete}
        title="KALICI OLARAK SİL"
        message={`${confirmDelete.data?.displayName} adlı personelin tüm sistem yetkileri ve verileri kalıcı olarak silinecektir. Bu operasyon geri döndürülemez.`}
        isDanger={true}
        confirmText="EVET, SİSTEMDEN ÇIKAR"
      />

      <ConfirmModal 
        isOpen={confirmToggle.open}
        onClose={() => setConfirmToggle({ open: false, data: null })}
        onConfirm={executeToggleAktif}
        title={confirmToggle.data?.aktif ? "PASİFE AL" : "AKTİFLEŞTİR"}
        message={confirmToggle.data?.aktif 
          ? `${confirmToggle.data?.displayName} adlı personel dondurulacaktır. Görev listelerinden ve planlamalardan geçici olarak çıkarılır.`
          : `${confirmToggle.data?.displayName} adlı personel operasyona geri dahil edilecektir.`
        }
        isDanger={confirmToggle.data?.aktif}
        confirmText="OPERASYONU ONAYLA"
      />
    </div>
  );
}
