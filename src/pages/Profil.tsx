import React, { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useMuezzinStore } from '../store/useMuezzinStore';

// Kritik bileşenler — hemen yükle
import ProfileHeader from './profil/ProfileHeader';
import ProfileBadges from './profil/ProfileBadges';
import ProfileStats from './profil/ProfileStats';

// Ağır bileşenler — lazy: yalnızca ekrana gelince yüklensin
const PersonalHistoryCard   = lazy(() => import('./profil/PersonalHistoryCard'));

/** Hafif bir inline yükleme iskeleti */
function SectionSkeleton() {
  return (
    <div className="skeleton-shimmer h-40 rounded-card border border-[var(--text-primary)]/[0.04]" />
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
  const user = useAuthStore(s => s.user);
  const authInitialized = useAuthStore(s => s.initialized);

  // Kendi profilimiz zaten global useMuezzinStore aboneliğinde mevcut
  // (bkz. StoreInitializer, tüm oturum boyunca `muezzins` koleksiyonunun
  // tamamını dinler) — burada ayrı bir muezzins/{uid} dinleyicisi açmak
  // yerine aynı veriyi paylaşılan store'dan okuyoruz. Önceden Profil.tsx ve
  // MuezzinAyarlari.tsx aynı dokümanı birbirinden bağımsız iki kez
  // dinliyordu (bkz. tasarım denetimi).
  const userData = useMuezzinStore(s => (user ? s.muezzinMap[user.uid] : undefined)) ?? null;
  const muezzinlerLoading = useMuezzinStore(s => s.loading);
  const loading = !authInitialized || (!!user && muezzinlerLoading);

  const currentAylikVakit = userData?.aylikVakitSayisi || 0;

  return (
    // pb-8: Layout.tsx'teki <main> zaten dock temizliği için pb ayırıyor (bkz.
    // MuezzinAnaEkran.tsx yorumu, mobil yerleşim denetimi) — pb-40 bununla üst
    // üste binip sayfa sonunda gereksiz boşluk bırakıyordu.
    <div className="min-h-screen pb-8 relative overflow-hidden">
      {/* Background Flair */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-[var(--aura-indigo)]/5 blur-[140px] rounded-full opacity-[var(--aura-opacity)]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-[var(--aura-ruby)]/5 blur-[140px] rounded-full opacity-[var(--aura-opacity)]" />
      </div>

      <div className="max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto px-6 pt-12 md:pt-20 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="w-16 h-16 border border-[var(--glass-border)] rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-t-2 border-[var(--aura-indigo)] rounded-full animate-spin" />
            </div>
            <p className="premium-label !text-2xs !opacity-55 animate-pulse">VERİLER SENKRONİZE EDİLİYOR</p>
          </div>
        ) : (
          <div className="space-y-10">

            {/* 1. Header Profile Box — kritik, hemen render */}
            <ProfileHeader userData={userData} user={user} />

            {/* 2. Rozet İstasyonu — hafif, hemen render */}
            <ProfileBadges aylikVakitSayisi={currentAylikVakit} />

            {/* 3. Core Profile Stats — hafif, hemen render */}
            <ProfileStats userData={userData} />

            {/* 4. Ağır bileşen — LazySection ile kademeli yükleme */}
            <LazySection>
              <Suspense fallback={<SectionSkeleton />}>
                <PersonalHistoryCard user={user} />
              </Suspense>
            </LazySection>
          </div>
        )}
      </div>
    </div>
  );
}
