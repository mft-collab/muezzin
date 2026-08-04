import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, AlertCircle, CheckCircle2, Hourglass, Trash2, Send } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { getTurkeyDateString } from '../lib/dateUtils';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Modal } from './ui/Modal';

interface VacationRequestCardProps {
  user: FirebaseUser | null;
}

interface IzinTalep {
  id?: string;
  uid: string;
  baslangic: string;
  bitis: string;
  tip: 'haftalik' | 'yillik' | 'mazeret';
  sebep: string;
  durum: 'onay_bekliyor' | 'onaylandi' | 'reddedildi';
  olusturmaTarihi: Timestamp;
}

export default function VacationRequestCard({ user }: VacationRequestCardProps) {
  const [baslangic, setBaslangic] = useState('');
  const [bitis, setBitis] = useState('');
  const [tip, setTip] = useState<'haftalik' | 'yillik' | 'mazeret'>('haftalik');
  const [sebep, setSebep] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [talepler, setTalepler] = useState<IzinTalep[]>([]);
  const [loadingTalepler, setLoadingTalepler] = useState(true);

  // Kullanıcı değiştiğinde yükleme durumunu render sırasında ayarla —
  // bkz. useBugunkuGorevlerim.ts'teki aynı desen.
  const [lastUserUid, setLastUserUid] = useState(user?.uid);
  if (user?.uid !== lastUserUid) {
    setLastUserUid(user?.uid);
    if (user) {
      setLoadingTalepler(true);
    }
  }

  // Real-time listener for current user's leaves
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'izinler'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IzinTalep[];

      // Sort by creation date descending
      data.sort((a, b) => {
        const timeA = a.olusturmaTarihi?.toMillis() || 0;
        const timeB = b.olusturmaTarihi?.toMillis() || 0;
        return timeB - timeA;
      });

      setTalepler(data);
      setLoadingTalepler(false);
    }, (err) => {
      console.error('İzin talepleri dinlenirken hata:', err);
      setLoadingTalepler(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    if (!baslangic || !bitis || !sebep.trim()) {
      setErrorMessage('Lütfen tüm alanları doldurun.');
      return;
    }

    const start = new Date(baslangic);
    const end = new Date(bitis);
    const today = new Date(getTurkeyDateString());

    if (start < today) {
      setErrorMessage('Başlangıç tarihi bugünden önce olamaz.');
      return;
    }

    if (end < start) {
      setErrorMessage('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }

    // Friday exclusion validation
    let hasFriday = false;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 5) {
        hasFriday = true;
        break;
      }
    }

    if (hasFriday) {
      setErrorMessage('Cuma günü, haftalık mihrap koordinasyonunun aksamaması adına izin kapsamına alınamaz.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'izinler'), {
        uid: user.uid,
        baslangic,
        bitis,
        tip,
        sebep: sebep.trim(),
        durum: 'onay_bekliyor',
        olusturmaTarihi: Timestamp.now()
      });

      setSuccessMessage('İzin talebiniz başarıyla oluşturuldu, yönetici onayına gönderildi.');
      setSebep('');
      setBaslangic('');
      setBitis('');
      setTimeout(() => {
        setSuccessMessage(null);
        setIsModalOpen(false);
      }, 3000);
    } catch (err) {
      console.error('İzin talebi oluşturulamadı:', err);
      setErrorMessage('Talep gönderilirken sistemsel bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      setTimeout(() => setPendingDeleteId(null), 3000);
      return;
    }
    setPendingDeleteId(null);
    try {
      await deleteDoc(doc(db, 'izinler', id));
    } catch (err) {
      console.error('İzin talebi iptal edilemedi:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Compact Interactive Station Bento Card */}
      <motion.div 
        whileHover={{ y: -4, scale: 1.01, boxShadow: '0 20px 40px -15px var(--dynamic-aura, rgba(99, 102, 241, 0.15))' }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsModalOpen(true)}
        className="p-8 spatial-glass rounded-[40px] border-[var(--glass-border)] shadow-[var(--spatial-shadow)] relative overflow-hidden cursor-pointer group hover:border-[var(--dynamic-aura,var(--aura-indigo))]/30 transition-all duration-500 text-left"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
        <div className="absolute right-[-10%] top-[-10%] w-40 h-40 bg-[var(--dynamic-aura,var(--aura-indigo))]/5 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <h4 className="premium-label !text-2xs !opacity-70 tracking-wide uppercase">İZİN & MAZERET TALEBİ</h4>
            </div>
            <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed max-w-sm font-light">
              Haftalık izin, yıllık izin ve mazeret taleplerinizi yönetici onayına iletmek için dokunun.
            </p>
          </div>
          
          <button 
            type="button"
            className="px-6 py-[18px] bg-[var(--dynamic-aura,var(--aura-indigo))] text-[var(--text-primary)] rounded-2xl text-2xs font-bold uppercase tracking-wider flex items-center gap-3 shadow-lg group-hover:scale-105 transition-all duration-300 border-none cursor-pointer"
          >
            <Calendar size={13} strokeWidth={2} />
            <span>TALEP OLUŞTUR</span>
          </button>
        </div>
      </motion.div>

      {/* Vacation Request Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="İZİN & MAZERET TALEBİ"
      >
        <div className="flex flex-col py-2 relative text-left">
          <div className="flex flex-col gap-1.5 mb-6 opacity-60">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-2xs font-bold tracking-wide uppercase text-amber-500">YÖNETİCİ ONAYINA GÖNDERİLİR</p>
            </div>
            <span className="text-2xs opacity-40 font-mono">LÜTFEN BİLGİLERİ EKSİKSİZ VE DOĞRU BİR ŞEKİLDE DOLDURUNUZ.</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Start Date */}
              <div className="space-y-2">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--text-secondary)]/60">Başlangıç Tarihi</label>
                <input 
                  type="date"
                  value={baslangic}
                  onChange={e => setBaslangic(e.target.value)}
                  required
                  className="w-full bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] rounded-2xl p-[18px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--dynamic-aura,var(--aura-indigo))]/50 transition-all font-light text-sm shadow-inner"
                />
              </div>
              
              {/* End Date */}
              <div className="space-y-2">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--text-secondary)]/60">Bitiş Tarihi</label>
                <input 
                  type="date"
                  value={bitis}
                  onChange={e => setBitis(e.target.value)}
                  required
                  className="w-full bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] rounded-2xl p-[18px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--dynamic-aura,var(--aura-indigo))]/50 transition-all font-light text-sm shadow-inner"
                />
              </div>
            </div>

            {/* Leave Type Select */}
            <div className="space-y-2">
              <label className="text-2xs font-bold uppercase tracking-wider text-[var(--text-secondary)]/60">Muafiyet Türü</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'haftalik', label: 'Haftalık' },
                    { id: 'yillik', label: 'Yıllık' },
                    { id: 'mazeret', label: 'Mazeret' }
                  ] as const
                ).map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setTip(item.id)}
                    className={`py-3.5 rounded-xl text-2xs font-bold uppercase tracking-wider transition-all duration-300 border cursor-pointer ${
                      tip === item.id 
                        ? 'bg-[var(--dynamic-aura,var(--aura-indigo))]/20 border-[var(--dynamic-aura,var(--aura-indigo))]/30 text-[var(--dynamic-aura,var(--aura-indigo))]' 
                        : 'bg-transparent border-[var(--glass-border)] text-[var(--text-secondary)]/40 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Text Area */}
            <div className="space-y-2">
              <label className="text-2xs font-bold uppercase tracking-wider text-[var(--text-secondary)]/60">İzin Gerekçesi</label>
              <textarea
                value={sebep}
                onChange={e => setSebep(e.target.value)}
                placeholder="Gerekçenizi detaylıca belirtiniz..."
                rows={3}
                required
                className="w-full bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] rounded-2xl p-5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--dynamic-aura,var(--aura-indigo))]/50 transition-all font-light text-sm shadow-inner placeholder:opacity-20 placeholder:font-extralight"
              />
            </div>

            {/* Alerts Feedback */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-5 rounded-[22px] bg-rose-500/10 border border-rose-500/20 text-rose-500 text-2xs leading-relaxed flex items-start gap-3.5"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
              {successMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-5 rounded-[22px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-2xs leading-relaxed flex items-start gap-3.5"
                >
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions Grid */}
            <div className="pt-4 flex items-center gap-6">
              <motion.button
                whileHover={{ y: -3, scale: 1.01, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 py-5 rounded-2xl bg-[var(--dynamic-aura,var(--aura-indigo))] text-[var(--text-primary)] text-2xs font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-3 border-none cursor-pointer ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-[var(--text-primary)]/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={14} strokeWidth={2} />
                )}
                {isSubmitting ? 'TALEBİNİZ GÖNDERİLİYOR...' : 'İZİN TALEBİNİ GÖNDER'}
              </motion.button>
              
              <motion.button
                whileHover={{ backgroundColor: 'var(--surface-medium)' }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-8 py-5 text-2xs font-bold uppercase tracking-wide text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all border border-[var(--glass-border)] rounded-2xl cursor-pointer bg-transparent"
              >
                VAZGEÇ
              </motion.button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Leave Requests History (Bento Flow) */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pl-2">
          <Calendar size={16} className="text-[var(--text-secondary)]/40" />
          <h4 className="premium-label !text-2xs !opacity-70 tracking-wide uppercase">İzin Taleplerim ve Durum Akışı</h4>
        </div>

        {loadingTalepler ? (
          <div className="p-8 text-center spatial-glass rounded-3xl border border-[var(--glass-border)]">
            <div className="w-6 h-6 border-2 border-[var(--dynamic-aura,var(--aura-indigo))]/20 border-t-[var(--dynamic-aura,var(--aura-indigo))] rounded-full animate-spin mx-auto" />
          </div>
        ) : talepler.length === 0 ? (
          <div className="p-8 text-center spatial-glass rounded-[32px] border-dashed border-[var(--text-primary)]/5">
            <p className="text-2xs text-[var(--text-secondary)]/75 font-light">Kayıtlı aktif bir izin talebiniz bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {talepler.map(talep => {
              const startFmt = format(parseISO(talep.baslangic), 'd MMM yyyy', { locale: tr });
              const endFmt = format(parseISO(talep.bitis), 'd MMM yyyy', { locale: tr });
              const typeLabel = talep.tip === 'yillik' ? 'Yıllık İzin' : talep.tip === 'haftalik' ? 'Haftalık İzin' : 'Mazeret İzni';

              return (
                <motion.div
                  key={talep.id}
                  whileHover={{ y: -2 }}
                  className="p-5 sm:p-6 spatial-glass rounded-[30px] border border-[var(--glass-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden"
                >
                  {/* Status Indicator Bar */}
                  <div className={`absolute top-0 left-0 bottom-0 w-[3px] ${
                    talep.durum === 'onaylandi' ? 'bg-[var(--status-success)]/40' :
                    talep.durum === 'reddedildi' ? 'bg-[var(--status-danger)]/40' : 'bg-[var(--status-warning)]/40'
                  }`} />

                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                      talep.durum === 'onaylandi' ? 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20' :
                      talep.durum === 'reddedildi' ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/20' : 'bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/20'
                    }`}>
                      {talep.durum === 'onaylandi' ? <CheckCircle2 size={18} /> :
                       talep.durum === 'reddedildi' ? <AlertCircle size={18} /> : <Hourglass size={18} />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)]">{typeLabel}</span>
                        <span className="text-2xs opacity-40 font-mono">({startFmt} - {endFmt})</span>
                      </div>
                      <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed font-light italic">
                        "{talep.sebep}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-auto sm:ml-0">
                    <span className={`px-4 py-1.5 rounded-full text-2xs font-bold uppercase tracking-wider border shadow-sm ${
                      talep.durum === 'onaylandi' ? 'bg-[var(--status-success)]/10 border-[var(--status-success)]/20 text-[var(--status-success)]' :
                      talep.durum === 'reddedildi' ? 'bg-[var(--status-danger)]/10 border-[var(--status-danger)]/20 text-[var(--status-danger)]' : 'bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20 text-[var(--status-warning)]'
                    }`}>
                      {talep.durum === 'onaylandi' ? 'ONAYLI' :
                       talep.durum === 'reddedildi' ? 'RED' : 'ONAY BEKLİYOR'}
                    </span>

                    {talep.durum === 'onay_bekliyor' && (
                      <motion.button
                        whileHover={{ scale: 1.1, backgroundColor: pendingDeleteId === talep.id ? 'color-mix(in srgb, var(--status-danger) 20%, transparent)' : 'color-mix(in srgb, var(--status-danger) 10%, transparent)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleCancelRequest(talep.id!)}
                        className={`w-8 h-8 rounded-xl bg-transparent border flex items-center justify-center transition-all cursor-pointer ${
                          pendingDeleteId === talep.id
                            ? 'border-[var(--status-danger)]/50 text-[var(--status-danger)] animate-pulse'
                            : 'border-[var(--text-primary)]/5 text-[var(--text-secondary)]/35 hover:text-[var(--status-danger)] hover:border-[var(--status-danger)]/25'
                        }`}
                        title={pendingDeleteId === talep.id ? 'Onaylamak için tekrar tıklayın' : 'İptale tıklayın'}
                        aria-label={pendingDeleteId === talep.id ? 'Onaylamak için tekrar tıklayın' : 'İzin talebini iptal et'}
                      >
                        <Trash2 size={13} />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
