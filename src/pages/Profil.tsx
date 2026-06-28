import React, { useState, useEffect, Suspense, lazy, useRef, useCallback } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { LogOut, Award, Shield, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { HakkindaModal } from '../components/HakkindaModal';
import { playClick } from '../lib/sounds';

// Kritik bileşenler — hemen yükle
import ProfileHeader from './profil/ProfileHeader';
import ProfileStats from './profil/ProfileStats';

// Ağır bileşenler — lazy: yalnızca ekrana gelince yüklensin
const NotificationSettings = lazy(() => import('./profil/NotificationSettings'));
const VacationRequestCard   = lazy(() => import('./profil/VacationRequestCard'));
const PersonalHistoryCard   = lazy(() => import('./profil/PersonalHistoryCard'));

export interface UserData {
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

/** Hafif bir inline yükleme iskeleti */
function SectionSkeleton() {
  return (
    <div className="skeleton-shimmer h-40 rounded-[40px] border border-white/[0.04]" />
  );
}

/**
 * LazySection: İçeriği yalnızca viewport'a girdiğinde render eder.
 * Bu, mobil cihazlarda sayfa açılışındaki eş zamanlı ağır yükü dağıtır.
 */
function LazySection({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Intersection Observer: bileşen %10 göründüğünde aktifleştir
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // Bir kez görününce görevini tamamladı
        }
      },
      { rootMargin: '120px', threshold: 0.1 } // 120px önceden başlat (akıcı deneyim)
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible
        ? children
        : (fallback ?? <SectionSkeleton />)
      }
    </div>
  );
}

export default function Profil() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const navigate = useNavigate();

  const user = useAuthStore(s => s.user);
  const authInitialized = useAuthStore(s => s.initialized);

  useEffect(() => {
    if (!authInitialized) return;

    if (user) {
      setLoading(true);
      const unsubscribe = onSnapshot(doc(db, 'muezzins', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserData);
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

  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (err) {
      console.error('Çıkış yapılamadı', err);
    }
  }, [navigate]);

  const currentAylikVakit = userData?.aylikVakitSayisi || 0;

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
            <p className="premium-label !text-[10px] !opacity-55 animate-pulse">VERİLER SENKRONİZE EDİLİYOR</p>
          </div>
        ) : (
          <div className="space-y-10">

            {/* 1. Header Profile Box — kritik, hemen render */}
            <ProfileHeader userData={userData} user={user} />

            {/* 2. Rozet İstasyonu — hafif, hemen render */}
            <motion.div
              whileHover={{ y: -4 }}
              className="p-8 spatial-glass rounded-[40px] border-[var(--glass-border)] shadow-[var(--spatial-shadow)] relative overflow-hidden text-left"
            >
              <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--aura-rose)] animate-pulse" />
                  <h4 className="premium-label !text-[9px] !opacity-70 tracking-wide uppercase">HİZMET VE SADAKAT ROZETLERİ</h4>
                </div>
                <span className="text-[8px] font-bold text-[var(--aura-rose)] bg-[var(--aura-rose)]/10 px-4 py-1.5 rounded-full uppercase tracking-wide">
                  BAŞARI NİŞANLARI
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 relative z-10">
                {([
                  {
                    label: 'Mihrap Muhafızı',
                    desc: '5 Vakit Hizmet',
                    threshold: 5,
                    icon: <User size={20} strokeWidth={1.5} />,
                    activeCard: 'spatial-glass-elevated border-[var(--status-success)]/20 bg-gradient-to-b from-[var(--status-success)]/8 to-[var(--status-success)]/3',
                    activeIcon: 'bg-[var(--status-success)]/15 text-[var(--status-success)] border-[var(--status-success)]/25 shadow-[0_0_12px_color-mix(in_srgb,var(--status-success)_30%,transparent)] animate-pulse',
                  },
                  {
                    label: 'Sadakat Hadimi',
                    desc: '15 Vakit Hizmet',
                    threshold: 15,
                    icon: <Award size={20} strokeWidth={1.5} />,
                    activeCard: 'spatial-glass-elevated border-[var(--aura-indigo)]/20 bg-gradient-to-b from-[var(--aura-indigo)]/8 to-[var(--aura-indigo)]/3',
                    activeIcon: 'bg-[var(--aura-indigo)]/15 text-[var(--aura-indigo)] border-[var(--aura-indigo)]/25 shadow-[0_0_12px_color-mix(in_srgb,var(--aura-indigo)_30%,transparent)] animate-pulse',
                  },
                  {
                    label: 'Vakit Emini',
                    desc: '30 Vakit Hizmet',
                    threshold: 30,
                    icon: <Shield size={20} strokeWidth={1.5} />,
                    activeCard: 'spatial-glass-elevated border-[var(--status-warning)]/20 bg-gradient-to-b from-[var(--status-warning)]/8 to-[var(--status-warning)]/3',
                    activeIcon: 'bg-[var(--status-warning)]/15 text-[var(--status-warning)] border-[var(--status-warning)]/25 shadow-[0_0_12px_color-mix(in_srgb,var(--status-warning)_30%,transparent)] animate-pulse',
                  },
                ] as const).map((badge) => {
                  const earned = currentAylikVakit >= badge.threshold;
                  return (
                    <div
                      key={badge.label}
                      className={`p-4 rounded-[26px] border flex flex-col items-center justify-center text-center gap-2.5 transition-all duration-500 ${
                        earned ? badge.activeCard : 'bg-[var(--text-primary)]/[0.008] border-[var(--text-primary)]/5 opacity-35'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md border ${
                        earned ? badge.activeIcon : 'bg-[var(--text-primary)]/5 text-[var(--text-primary)]/20 border-[var(--text-primary)]/5'
                      }`}>
                        {badge.icon}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-[var(--text-primary)] leading-none">{badge.label}</p>
                        <p className="text-[7.5px] text-[var(--text-secondary)]/50 leading-tight mt-1">{badge.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* 3. Core Profile Stats — hafif, hemen render */}
            <ProfileStats userData={userData} />

            {/* 4-6. Ağır bileşenler — LazySection ile kademeli yükleme */}
            <LazySection>
              <Suspense fallback={<SectionSkeleton />}>
                <VacationRequestCard user={user} />
              </Suspense>
            </LazySection>

            <LazySection>
              <Suspense fallback={<SectionSkeleton />}>
                <PersonalHistoryCard user={user} />
              </Suspense>
            </LazySection>

            <LazySection>
              <Suspense fallback={<SectionSkeleton />}>
                <NotificationSettings userData={userData} user={user} />
              </Suspense>
            </LazySection>

            {/* Çıkış Bölümü */}
            <div className="space-y-6 pt-8">
              <motion.button
                whileHover={{ scale: 1.01, backgroundColor: 'hsla(var(--bg-h), 100%, 50%, 0.08)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full py-6 flex items-center justify-center gap-5 bg-[var(--status-error)]/[0.04] border border-[var(--status-error)]/20 text-[var(--status-error)] hover:border-[var(--status-error)]/40 hover:shadow-[0_20px_50px_-10px_var(--status-error)] transition-all duration-700 rounded-[32px] text-[10px] font-bold uppercase tracking-wide group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <LogOut size={18} strokeWidth={2.5} className="transition-transform duration-500 group-hover:-translate-x-1.5" />
                <span>SİSTEMDEN GÜVENLİ ÇIKIŞ</span>
              </motion.button>

              <div className="text-center pb-10">
                <button 
                  onClick={() => {
                    playClick();
                    setIsAboutOpen(true);
                  }}
                  className="group flex items-center justify-center gap-6 mx-auto hover:opacity-100 transition-opacity"
                >
                  <div className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--glass-border)] group-hover:to-white/20 transition-colors" />
                  <div className="flex flex-col items-center gap-1">
                    <p className="premium-label !text-[10px] !opacity-45 !font-bold tracking-wide group-hover:opacity-100 transition-opacity">v2.1.0</p>
                    <span className="text-[7px] font-bold text-white/20 group-hover:text-[var(--aura-indigo)] uppercase tracking-widest transition-colors">Hakkında</span>
                  </div>
                  <div className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--glass-border)] group-hover:to-white/20 transition-colors" />
                </button>
              </div>
            </div>

            {/* Hakkında Modalı */}
            <HakkindaModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
