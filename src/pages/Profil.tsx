import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { User, LogOut, Edit3, Shield, CheckCircle2, Award, ChevronRight, TrendingUp, Sun, Moon, AlertCircle, Calendar, BellRing } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useSystemSettingsStore } from '../store/useSystemSettingsStore';
import { useAuthStore } from '../store/useAuthStore';

interface UserData {
  displayName: string;
  email?: string;
  photoURL?: string;
  role: 'admin' | 'muezzin' | 'gozlemci';
  aktif: boolean;
  aylikVakitSayisi: number;
  kayitTarihi?: string;
  fcmToken?: string;
  haftalikIzinGunu?: number;
  notificationSettings?: {
    nobetHatirlatici: boolean;
    duyurular: boolean;
    mazeretDurumu: boolean;
  };
}

export default function Profil() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const navigate = useNavigate();
  const theme = useThemeStore(s => s.theme);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const settings = useSystemSettingsStore(s => s.settings);

  const user = useAuthStore(s => s.user);
  const authInitialized = useAuthStore(s => s.initialized);

  useEffect(() => {
    if (!authInitialized) return;

    if (user) {
      setLoading(true);
      // Real-time listener: resolves local cached updates and PWA permission token changes instantly
      const unsubscribe = onSnapshot(doc(db, 'muezzins', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserData;
          setUserData(data);
          setNewName(data.displayName || '');
        }
        setLoading(false);
      }, (err) => {
        console.error('Profil verisi dinlenemedi:', err);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setUserData(null);
      setLoading(false);
    }
  }, [user, authInitialized]);

  const handleUpdate = async () => {
    if (!user || !newName.trim()) return;
    const trimmedName = newName.trim();

    if (trimmedName.length < 3) {
      setUpdateError('Ad soyad en az 3 karakter olmalıdır.');
      return;
    }
    if (trimmedName.length > 40) {
      setUpdateError('Ad soyad en fazla 40 karakter olmalıdır.');
      return;
    }

    setUpdateError(null);
    setUpdateSuccess(false);
    try {
      await updateDoc(doc(db, 'muezzins', user.uid), { 
        displayName: trimmedName
      });
      // onSnapshot automatically updates state; no manual state sync needed
      setEditMode(false);
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err) {
      console.error('Profil güncellenemedi:', err);
      setUpdateError('Güncelleme başarısız. Lütfen tekrar deneyin.');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (err) {
      // Sign out operation failed
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Bu tarayıcı anlık bildirim sistemini desteklemiyor.');
      return;
    }
    
    if (Notification.permission === 'denied') {
      alert('Bildirim izinleri tarayıcınızda engellenmiş. Lütfen adres çubuğunun solundaki kilit/site ayarları simgesine tıklayarak bildirimlere manuel olarak izin verin.');
      return;
    }

    try {
      await Notification.requestPermission();
      // useFcmToken in Layout will automatically acquire token and write it to Firestore.
      // onSnapshot will immediately pick it up and update our UI reactively.
    } catch (err) {
      console.error('Bildirim izni istenirken hata:', err);
    }
  };

  const handleToggleSetting = async (key: 'nobetHatirlatici' | 'duyurular' | 'mazeretDurumu') => {
    if (!user || !userData) return;
    
    const currentSettings = userData.notificationSettings || {
      nobetHatirlatici: true,
      duyurular: true,
      mazeretDurumu: true
    };
    
    const newSettings = {
      ...currentSettings,
      [key]: !currentSettings[key]
    };
    
    try {
      await updateDoc(doc(db, 'muezzins', user.uid), {
        notificationSettings: newSettings
      });
      // onSnapshot handles reactive UI update
    } catch (err) {
      console.error('Bildirim tercihleri güncellenemedi:', err);
    }
  };

  const isAdmin = userData?.role === 'admin';

  const menuItems = [
    { 
      icon: <User size={16} />, 
      label: 'Görev Birimi', 
      value: settings.ilceAdi ? `${settings.ilceAdi} Müftülüğü` : 'Belirsiz', 
      color: 'text-[var(--aura-indigo)]', 
      bg: 'bg-[var(--aura-indigo)]/10',
      clickable: false
    },
    { 
      icon: <Award size={16} />, 
      label: 'Rol', 
      value: isAdmin ? 'Sistem Yöneticisi' : userData?.role === 'gozlemci' ? 'Gözlemci' : 'Görevli Müezzin', 
      color: 'text-[var(--status-success)]', 
      bg: 'bg-[var(--status-success)]/10',
      clickable: false
    },
    { 
      icon: <Shield size={16} />, 
      label: 'Hesap Durumu', 
      value: userData?.aktif ? 'Aktif ve Doğrulanmış' : 'Pasif', 
      color: userData?.aktif ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]', 
      bg: userData?.aktif ? 'bg-[var(--status-success)]/10' : 'bg-[var(--status-danger)]/10',
      clickable: false
    },
    { 
      icon: <Calendar size={16} />, 
      label: 'Haftalık Sabit İzin Günü', 
      value: userData?.haftalikIzinGunu !== undefined ? (['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][userData.haftalikIzinGunu] || 'Tanımlanmamış') : 'Tanımlanmamış', 
      color: 'text-[var(--aura-amber)]', 
      bg: 'bg-[var(--aura-amber)]/10',
      clickable: false
    },
    { 
      icon: <BellRing size={16} />, 
      label: 'Cihaz Bildirim Bağlantısı', 
      value: userData?.fcmToken ? 'Aktif (Bu Cihaz Bağlı)' : 'Pasif (Bildirim Etkinleştir)', 
      color: userData?.fcmToken ? 'text-[var(--status-success)]' : 'text-[var(--aura-amber)]', 
      bg: userData?.fcmToken ? 'bg-[var(--status-success)]/10' : 'bg-[var(--aura-amber)]/10',
      onClick: handleRequestNotificationPermission,
      clickable: true
    },
  ];

  return (
    <div className="min-h-screen pb-40 relative overflow-hidden">
      {/* Background Flair */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--aura-indigo)]/5 blur-[140px] rounded-full opacity-[var(--aura-opacity)]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-[var(--aura-ruby)]/5 blur-[140px] rounded-full opacity-[var(--aura-opacity)]" />
      </div>

      <div className="max-w-xl mx-auto px-6 pt-12 md:pt-20 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-16 h-16 border border-[var(--glass-border)] rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-t-2 border-[var(--aura-indigo)] rounded-full animate-spin" />
            </div>
            <p className="premium-label !text-[10px] !opacity-20 animate-pulse">VERİLER SENKRONİZE EDİLİYOR</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Header: Pro Profile Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden p-8 md:p-10 spatial-glass border-[var(--glass-border)] shadow-[var(--spatial-shadow)]"
            >
              
              <div className="relative z-10 flex flex-col items-center text-center gap-6">
                <div className="relative group">
                  <motion.div 
                    whileHover={{ scale: 1.05, rotate: 2 }}
                    className="w-28 h-28 rounded-[40px] bg-[var(--text-primary)]/[0.04] backdrop-blur-3xl border border-[var(--glass-border)] flex items-center justify-center text-6xl font-extralight shadow-2xl overflow-hidden transition-all duration-700"
                  >
                    <span className="relative z-10 text-[var(--text-primary)]/90 drop-shadow-2xl">{userData?.displayName?.charAt(0) || 'U'}</span>
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--aura-indigo)]/20 via-transparent to-[var(--aura-ruby)]/15" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent_70%)]" />
                  </motion.div>
                  {userData?.aktif && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-2 -right-2 w-9 h-9 rounded-2xl bg-[var(--status-success)] border-[4px] border-[var(--app-bg)] flex items-center justify-center shadow-xl shadow-[var(--status-success)]/40"
                    >
                       <div className="w-2.5 h-2.5 rounded-full bg-[var(--app-bg)] animate-pulse" />
                    </motion.div>
                  )}
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center justify-center gap-4 w-full">
                    {editMode ? (
                      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                        <div className="relative w-full">
                          <input 
                            type="text" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                            className="bg-white/[0.01] border border-indigo-500/30 px-6 py-4.5 rounded-3xl text-2xl font-light text-[var(--text-primary)] outline-none focus:bg-white/[0.03] focus:border-indigo-500/50 text-center w-full transition-all apple-thin shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                            autoFocus
                          />
                          <div className="absolute inset-0 rounded-3xl border border-indigo-500/20 blur-sm pointer-events-none" />
                        </div>
                        <div className="flex items-center gap-3">
                          <motion.button 
                            whileHover={{ scale: 1.05, y: -1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleUpdate}
                            className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-[8px] font-extrabold uppercase tracking-[0.2em] shadow-lg flex items-center gap-1.5"
                          >
                            <CheckCircle2 size={11} /> GÜNCELLE
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.05, y: -1, backgroundColor: 'rgba(255,255,255,0.08)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setEditMode(false); setNewName(userData?.displayName || ''); }}
                            className="px-5 py-2.5 bg-white/5 border border-white/10 text-white/50 hover:text-white rounded-xl text-[8px] font-extrabold uppercase tracking-[0.2em] transition-all"
                          >
                            İPTAL
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-4">
                        <h3 className="text-3xl md:text-5xl font-light text-[var(--text-primary)] tracking-tight apple-thin hover:font-normal transition-all duration-700 cursor-default">
                          {userData?.displayName}
                        </h3>
                        <motion.button 
                          whileHover={{ scale: 1.1, backgroundColor: 'var(--surface-medium)' }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setEditMode(true)}
                          className="w-12 h-12 flex items-center justify-center bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] rounded-2xl transition-all shadow-lg"
                        >
                          <Edit3 size={18} className="text-[var(--text-secondary)]/40" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {updateSuccess && (
                      <motion.p 
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-[10px] font-bold text-[var(--status-success)] text-center tracking-[0.2em] uppercase"
                      >
                        ✓ KİMLİK VERİSİ GÜNCELLENDİ
                      </motion.p>
                    )}
                    {updateError && (
                      <motion.p 
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-[10px] font-bold text-[var(--status-danger)] text-center tracking-[0.2em] uppercase flex items-center justify-center gap-2"
                      >
                        <AlertCircle size={12} /> {updateError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-col items-center gap-1">
                    <div className="premium-label !text-[10px] !opacity-30 tracking-[0.2em]">
                      {userData?.email || auth.currentUser?.email}
                    </div>
                    <div className="text-[9px] font-bold text-[var(--text-primary)]/10 tracking-[0.4em] uppercase">
                      ID: {auth.currentUser?.uid?.toUpperCase() || 'BELİRSİZ'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  <div className="px-6 py-2.5 rounded-2xl text-[9px] font-bold uppercase tracking-[0.4em] bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[var(--text-primary)]/60 shadow-lg backdrop-blur-md">
                    {isAdmin ? <Shield size={10} className="inline mr-2 mb-0.5 text-[var(--aura-indigo)]" /> : <User size={10} className="inline mr-2 mb-0.5 text-[var(--aura-ruby)]" />}
                    {isAdmin ? 'SİSTEM YÖNETİCİSİ' : 'HİZMETLİ GÖREVLİ'}
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Performance Card */}
            <div className="p-8 spatial-glass rounded-[40px] flex flex-col sm:flex-row items-center justify-between gap-6 border-[var(--glass-border)] relative overflow-hidden shadow-xl">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[22px] bg-[var(--status-info)]/10 text-[var(--status-info)] flex items-center justify-center border border-[var(--status-info)]/20 shadow-xl">
                    <Award size={28} strokeWidth={1.5} />
                  </div>
                  <div className="text-left space-y-1">
                    <p className="premium-label !text-[10px] !opacity-40 tracking-[0.3em]">AYLIK İSTATİSTİK</p>
                    <h3 className="text-xl font-light text-[var(--text-primary)] tracking-tight">Hizmet Edilen Vakit</h3>
                  </div>
               </div>
               
               <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-light text-[var(--text-primary)] tracking-tight tabular-nums">{userData?.aylikVakitSayisi || 0}</span>
                  <span className="text-[10px] font-bold text-[var(--text-primary)]/40 tracking-widest uppercase"> Vakit</span>
               </div>
            </div>
            


            {/* Theme / Aesthetic Control */}
            <motion.div 
              whileHover={{ y: -4 }}
              onClick={toggleTheme}
              className="spatial-glass-elevated p-6 rounded-[32px] flex items-center justify-between group cursor-pointer border-[var(--glass-border)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--text-primary)]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-[var(--text-primary)]/[0.03] flex items-center justify-center text-[var(--text-primary)] border border-[var(--glass-border)] shadow-inner transition-transform group-hover:rotate-12 duration-700">
                  {theme === 'light' ? (
                    <Sun size={24} className="text-[var(--status-warning)] drop-shadow-[0_0_12px_var(--status-warning)]" strokeWidth={1.5} />
                  ) : (
                    <Moon size={24} className="text-[var(--aura-indigo)] opacity-60" strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <p className="premium-label !text-[9px] !opacity-20 mb-1">GÖRÜNÜM MODU</p>
                  <h4 className="text-xl font-light text-[var(--text-primary)] tracking-tight">
                    {theme === 'light' ? 'Ethereal Lux (Aydınlık)' : 'Deep Nox (Karanlık)'}
                  </h4>
                </div>
              </div>
              <div className="relative z-10 w-14 h-8 bg-[var(--text-primary)]/[0.08] rounded-full border border-[var(--glass-border)] flex items-center px-1.5 transition-all duration-500 group-hover:bg-[var(--text-primary)]/[0.12]">
                <motion.div 
                  layout
                  animate={{ 
                    x: theme === 'light' ? 0 : 24,
                    backgroundColor: theme === 'light' ? 'var(--text-primary)' : 'var(--aura-indigo)'
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-5 h-5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.4)] relative"
                >
                  <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              </div>
            </motion.div>

            {/* Notification Channel Preferences Bento Card */}
            <motion.div 
              whileHover={{ y: -4 }}
              className="p-8 spatial-glass rounded-[40px] border-[var(--glass-border)] shadow-2xl relative overflow-hidden"
            >
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <h4 className="premium-label !text-[9px] !opacity-30 tracking-[0.3em]">BİLDİRİM TERCİHLERİ VE TANI DİREKTİFİ</h4>
                </div>
                <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-4 py-1.5 rounded-full uppercase tracking-[0.25em]">
                  {userData?.fcmToken ? 'BAĞLANTI AKTİF' : 'İZİN GEREKLİ'}
                </span>
              </div>

              {/* Advanced Diagnostics Message */}
              <div className="mb-6 p-4 bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] rounded-[20px] flex items-start gap-4">
                <div className={`p-2.5 rounded-xl flex items-center justify-center shrink-0 ${
                  userData?.fcmToken 
                    ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]' 
                    : typeof window !== 'undefined' && !('Notification' in window)
                      ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]'
                      : typeof window !== 'undefined' && Notification.permission === 'denied'
                        ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]'
                        : 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]'
                }`}>
                  <BellRing size={16} />
                </div>
                <div className="space-y-1">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">SİSTEM DURUM TANI</h5>
                  <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed font-light">
                    {userData?.fcmToken 
                      ? 'Anlık bildirim alıcınız başarıyla Google sunucularına bağlandı ve bu cihaz yetkilendirildi.' 
                      : typeof window !== 'undefined' && !('Notification' in window)
                        ? 'Bu cihazın tarayıcısı Web-Push anlık bildirim sistemini desteklemiyor.'
                        : typeof window !== 'undefined' && Notification.permission === 'denied'
                          ? 'Tarayıcı bildirim izinleri kalıcı olarak engellenmiş. Lütfen adres çubuğundaki kilit simgesinden izin verin.'
                          : 'İzin verilmemiş veya cihaz kaydı yok. Lütfen aşağıdaki Cihaz Bildirim Bağlantısı satırından bildirimleri etkinleştirin.'}
                  </p>
                </div>
              </div>

              {/* Preferences Toggles */}
              <div className="space-y-5">
                {[
                  {
                    key: 'nobetHatirlatici',
                    title: 'Nöbet & Vakit Hatırlatıcıları',
                    desc: 'Adınıza atanan nöbet saatleri yaklaşırken anlık uyarı alırsınız.'
                  },
                  {
                    key: 'duyurular',
                    title: 'Resmi Tebliğler & Duyurular',
                    desc: 'Yönetim tarafından yayınlanan resmi tebliğlerden anında haberdar olursunuz.'
                  },
                  {
                    key: 'mazeretDurumu',
                    title: 'Mazeret & İzin Talebi Güncellemeleri',
                    desc: 'Gönderdiğiniz mazeret veya izin talebi onaylandığında anlık bildirim alırsınız.'
                  }
                ].map((setting) => {
                  const currentSettings = userData?.notificationSettings || {
                    nobetHatirlatici: true,
                    duyurular: true,
                    mazeretDurumu: true
                  };
                  const isChecked = currentSettings[setting.key as 'nobetHatirlatici' | 'duyurular' | 'mazeretDurumu'] !== false;

                  return (
                    <div key={setting.key} className="flex items-center justify-between gap-6 py-2">
                      <div className="space-y-1">
                        <h5 className="text-xs font-semibold text-[var(--text-primary)]">{setting.title}</h5>
                        <p className="text-[9px] text-[var(--text-secondary)]/40 leading-normal max-w-[280px] font-light">{setting.desc}</p>
                      </div>
                      <button 
                        onClick={() => handleToggleSetting(setting.key as any)}
                        className={`w-12 h-7 rounded-full border border-[var(--glass-border)] flex items-center px-1 transition-all duration-500 cursor-pointer ${
                          isChecked ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-[var(--text-primary)]/[0.04]'
                        }`}
                      >
                        <motion.div 
                          layout
                          animate={{ 
                            x: isChecked ? 20 : 0,
                            backgroundColor: isChecked ? 'var(--status-info)' : 'var(--text-secondary)'
                          }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="w-4 h-4 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>

             {/* Quick Glance Info Cards */}
             <div className="spatial-glass rounded-[40px] p-4 sm:p-8 shadow-[var(--spatial-shadow)] border-[var(--glass-border)] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--text-primary)]/[0.01] to-transparent pointer-events-none" />
                
                <div className="divide-y divide-[var(--glass-border)] relative z-10">
                 {menuItems.map((item: any, idx) => (
                   <motion.div 
                     key={idx} 
                     whileHover={item.clickable ? { x: 4 } : {}}
                     onClick={item.onClick ? item.onClick : undefined}
                     className={`flex items-center justify-between py-8 first:pt-0 last:pb-0 group transition-all ${
                       item.clickable ? 'cursor-pointer' : 'cursor-default'
                     }`}
                   >
                     <div className="flex items-center gap-6">
                       <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center transition-all ${
                         item.clickable ? 'group-hover:scale-110 group-hover:rotate-3 shadow-xl' : 'shadow-sm'
                       }`}>
                         {React.cloneElement(item.icon as React.ReactElement, { size: 20, strokeWidth: 1.5 })}
                       </div>
                       <div>
                         <p className="premium-label !text-[10px] !opacity-20 mb-1.5 leading-tight tracking-[0.2em]">{item.label}</p>
                         <p className="text-lg font-light text-[var(--text-primary)] tracking-tight leading-tight transition-all duration-500">{item.value}</p>
                       </div>
                     </div>
                     {item.clickable && (
                       <div className="w-10 h-10 rounded-xl bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--text-primary)]/[0.05] transition-all">
                         <ChevronRight size={18} className="text-[var(--text-secondary)]/20 group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)] transition-all" />
                       </div>
                     )}
                   </motion.div>
                 ))}
               </div>
             </div>

            {/* Logout Section */}
            <div className="space-y-8 pt-12">
              <motion.button 
                whileHover={{ scale: 1.01, backgroundColor: 'hsla(var(--bg-h), 100%, 50%, 0.08)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout} 
                className="w-full py-6 flex items-center justify-center gap-5 bg-[var(--status-error)]/[0.04] border border-[var(--status-error)]/20 text-[var(--status-error)] hover:border-[var(--status-error)]/40 hover:shadow-[0_20px_50px_-10px_var(--status-error)] transition-all duration-700 rounded-[32px] text-[10px] font-bold uppercase tracking-[0.4em] group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <LogOut size={18} strokeWidth={2.5} className="transition-transform duration-500 group-hover:-translate-x-1.5" /> 
                <span>SİSTEMDEN GÜVENLİ ÇIKIŞ</span>
              </motion.button>
              
              <div className="text-center space-y-8 pb-10">
                <div className="flex items-center justify-center gap-8">
                   <div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--glass-border)]" />
                   <p className="premium-label !text-[10px] !opacity-10 !font-bold tracking-[0.5em]">v2.0.0</p>
                   <div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--glass-border)]" />
                </div>
                <div className="space-y-4 opacity-10">
                  <p className="premium-label !text-[8px] !normal-case leading-relaxed max-w-[340px] mx-auto tracking-[0.25em]">
                    BU BİLGİ SİSTEMİ, CAMİ VE DİN HİZMETLERİNİN DÜZENLİ VE ETKİN BİR ŞEKİLDE YÜRÜTÜLMESİ MAKSADIYLA GELİŞTİRİLMİŞTİR.
                  </p>
                  <p className="text-[7px] font-bold tracking-[0.1em]">© 2026 CAMİ HİZMETLERİ KOORDİNASYON SİSTEMİ • TÜM HAKLARI SAKLIDIR</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
