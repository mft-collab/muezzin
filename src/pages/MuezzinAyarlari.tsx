import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { LogOut, Info, Settings, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { UserData } from './Profil';
import { HakkindaModal } from '../components/HakkindaModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { playClick } from '../lib/sounds';

const NotificationSettings = lazy(() => import('./profil/NotificationSettings'));

function SettingsSkeleton() {
  return <div className="h-72 rounded-[40px] fluid-skeleton" />;
}

export default function MuezzinAyarlari() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const navigate = useNavigate();

  const user = useAuthStore(s => s.user);
  const authInitialized = useAuthStore(s => s.initialized);

  useEffect(() => {
    if (!authInitialized) return;

    if (!user) {
      setUserData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'muezzins', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserData(docSnap.data() as UserData);
      }
      setLoading(false);
    }, (err) => {
      console.error('Ayar profil verisi dinlenemedi:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authInitialized]);

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false);
    await auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen pb-40 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--aura-indigo)]/5 blur-[140px] rounded-full opacity-[var(--aura-opacity)]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-[var(--aura-emerald)]/5 blur-[140px] rounded-full opacity-[var(--aura-opacity)]" />
      </div>

      <div className="max-w-xl mx-auto px-6 pt-12 md:pt-20 relative z-10 space-y-8">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="spatial-glass p-8 rounded-[40px] border-[var(--glass-border)] shadow-[var(--spatial-shadow)]"
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[22px] bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] border border-[var(--dynamic-aura,var(--aura-indigo))]/20 flex items-center justify-center">
              <Settings size={24} strokeWidth={1.5} />
            </div>
            <div>
              <p className="premium-label !text-[9px] !opacity-50 tracking-wide">KİŞİSEL UYGULAMA AYARLARI</p>
              <h1 className="text-3xl font-light text-[var(--text-primary)] tracking-tight mt-1">Ayarlar</h1>
            </div>
          </div>
        </motion.header>

        {loading ? (
          <SettingsSkeleton />
        ) : (
          <Suspense fallback={<SettingsSkeleton />}>
            <NotificationSettings userData={userData} user={user} />
          </Suspense>
        )}

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="spatial-glass rounded-[40px] p-5 sm:p-8 border-[var(--glass-border)] shadow-[var(--spatial-shadow)]"
        >
          <div className="divide-y divide-[var(--glass-border)]">
            <button
              type="button"
              onClick={() => {
                playClick();
                setIsAboutOpen(true);
              }}
              className="w-full flex items-center justify-between gap-5 py-5 first:pt-0 text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[var(--text-primary)]/[0.04] border border-[var(--glass-border)] text-[var(--text-primary)]/55 flex items-center justify-center group-hover:text-[var(--dynamic-aura,var(--aura-indigo))] transition-colors">
                  <Info size={18} strokeWidth={1.6} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Hakkında</p>
                  <p className="text-[10px] text-[var(--text-secondary)]/75 mt-1">Sürüm, teknoloji ve uygulama bilgileri</p>
                </div>
              </div>
              <span className="premium-label !text-[9px] !opacity-35">v2.2.0</span>
            </button>

            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              className="w-full flex items-center justify-between gap-5 py-5 last:pb-0 text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500/70 flex items-center justify-center group-hover:text-rose-500 transition-colors">
                  <LogOut size={18} strokeWidth={1.6} />
                </div>
                <div>
                  <p className="text-sm font-medium text-rose-500/85">Oturumu Kapat</p>
                  <p className="text-[10px] text-[var(--text-secondary)]/75 mt-1">Bu cihazdaki aktif oturumu sonlandırır</p>
                </div>
              </div>
              <ShieldCheck size={16} className="text-[var(--text-secondary)]/25" />
            </button>
          </div>
        </motion.section>
      </div>

      <HakkindaModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <ConfirmModal
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
        title="Oturumu Kapat"
        message="Bu cihazdaki aktif oturumunuzu kapatmak üzeresiniz. Devam etmek istiyor musunuz?"
        confirmText="Çıkış Yap"
        cancelText="Vazgeç"
        isDanger
      />
    </div>
  );
}
