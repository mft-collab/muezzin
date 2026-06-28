import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, limit, getDocs, waitForPendingWrites } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Database, BellRing, Layers, Wifi, Play, Sparkles, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, Terminal, ShieldAlert } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export const SistemTestleriSekmesi = React.memo(({ setActiveTab }: { setActiveTab: (t: string) => void }) => {
  const [dbTestState, setDbTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeListeners, setActiveListeners] = useState<number>(0);

  const [fcmTestState, setFcmTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [fcmPermission, setFcmPermission] = useState<string | null>(null);
  const [fcmSwActive, setFcmSwActive] = useState<boolean | null>(null);

  const [pwaTestState, setPwaTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [pwaCacheSize, setPwaCacheSize] = useState<string | null>(null);
  const [pwaOfflineCapable, setPwaOfflineCapable] = useState<boolean | null>(null);
  const [swUpdateWaiting, setSwUpdateWaiting] = useState<boolean>(false);
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);

  const [networkTestState, setNetworkTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);

  // Sync Outbox State
  const [syncState, setSyncState] = useState<'synced' | 'pending' | 'checking'>('synced');

  // Diagnostics State
  const [diagState, setDiagState] = useState<'idle' | 'running' | 'success'>('idle');
  const [diagScore, setDiagScore] = useState<number>(0);
  const [diagReport, setDiagReport] = useState<{
    status: string;
    metrics: string[];
    suggestions: string[];
  } | null>(null);

  // Collapsible Sandbox State
  const [showSandbox, setShowSandbox] = useState<boolean>(false);
  const [confirmSimulateOpen, setConfirmSimulateOpen] = useState(false);

  // Hook into onSnapshot change telemetry
  useEffect(() => {
    setActiveListeners((window as any).__activeFirestoreListeners || 0);

    (window as any).__onFirestoreListenersChange = (count: number) => {
      setActiveListeners(count);
    };

    return () => {
      (window as any).__onFirestoreListenersChange = null;
    };
  }, []);

  // Run offline outbox sync check
  const runSyncCheck = async () => {
    setSyncState('checking');
    try {
      let isResolved = false;
      const timeout = setTimeout(() => {
        if (!isResolved) {
          setSyncState('pending');
        }
      }, 150);

      await waitForPendingWrites(db);
      isResolved = true;
      clearTimeout(timeout);
      setSyncState('synced');
    } catch (e) {
      console.error("Sync outbox check error:", e);
      setSyncState('synced');
    }
  };

  useEffect(() => {
    runSyncCheck();
  }, []);

  // Real-time SW check & manual update check
  const checkSwUpdate = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    setCheckingUpdate(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        setSwUpdateWaiting(!!reg.waiting);
      }
    } catch (e) {
      console.warn("SW update check error:", e);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const runHealthDiagnostics = () => {
    setDiagState('running');
    setTimeout(() => {
      let score = 60;
      const metrics: string[] = [];
      const suggestions: string[] = [];

      // 1. Database connection check
      if (dbTestState === 'success') {
        score += 10;
        if (dbLatency && dbLatency < 120) {
          score += 10;
          metrics.push(`Firestore DB Gecikmesi: ${dbLatency}ms (Çok Kararlı)`);
        } else if (dbLatency) {
          metrics.push(`Firestore DB Gecikmesi: ${dbLatency}ms (Orta Derece)`);
          suggestions.push("Firestore veri okuma gecikmesini azaltmak için verileri getDocs yerel önbellek ile cache edin.");
        }
      } else if (dbTestState === 'error') {
        score -= 20;
        metrics.push("Firestore DB Bağlantısı: Hatalı");
        suggestions.push("Veritabanı bağlantısı başarısız. Firebase firestore.rules güvenlik kurallarını gözden geçirin.");
      } else {
        metrics.push("Firestore DB: Yanıt süresi test edilmedi");
        suggestions.push("Firestore yanıt hızını netleştirmek için 'Veritabanı Katmanı' testini çalıştırın.");
      }

      // 2. Active Listeners check
      metrics.push(`Aktif Veri Abonelikleri (onSnapshot): ${activeListeners} adet`);
      if (activeListeners > 8) {
        score -= 5;
        suggestions.push(`Açık dinleyici sayısı yüksek (${activeListeners}). Firebase okuma maliyetlerini düşürmek için kullanılmayan sayfaların snapshot aboneliğini iptal edin.`);
      } else {
        score += 5;
      }

      // 3. Offline Outbox check
      if (syncState === 'pending') {
        score -= 10;
        metrics.push("Çevrimdışı Eşitleme Kuyruğu: Senkronize edilmemiş veriler var");
        suggestions.push("Cihaz çevrimdışı veya kuyrukta bekleyen eşitleme işlemleri var. Ağ bağlantısını kontrol edin.");
      } else {
        score += 10;
        metrics.push("Çevrimdışı Eşitleme Kuyruğu: Tüm veriler eşitlendi");
      }

      // 4. Notifications & FCM checks
      if (fcmTestState === 'success') {
        score += 5;
        if (fcmPermission === 'granted') {
          score += 5;
          metrics.push("Tarayıcı Bildirim İzni: Etkin");
        } else {
          metrics.push("Tarayıcı Bildirim İzni: Reddedildi");
          suggestions.push("Mobil/tarayıcı bildirimlerini alabilmek için bildirim izinlerini elle etkinleştirin.");
        }
      }

      // 5. Network Latency ping checks
      if (networkTestState === 'success') {
        score += 5;
        if (networkLatency && networkLatency < 100) {
          score += 5;
          metrics.push(`Ağ Yanıt Gecikmesi: ${networkLatency}ms (Fiber/Broadband)`);
        } else if (networkLatency) {
          metrics.push(`Ağ Yanıt Gecikmesi: ${networkLatency}ms`);
        }
      }

      // 6. SW Version check
      if (swUpdateWaiting) {
        score -= 5;
        metrics.push("PWA Durumu: Yeni güncelleme bekliyor");
        suggestions.push("Yeni bir uygulama güncellemesi hazır. PWA sürümünü aktif etmek için tarayıcı sayfasını yenileyin.");
      }

      const finalScore = Math.max(0, Math.min(100, score));
      setDiagScore(finalScore);

      let statusMsg = "";
      if (finalScore >= 90) {
        statusMsg = "Sisteminiz son derece sağlıklı ve tam performansla çalışıyor. Herhangi bir kritik optimizasyon ihtiyacı bulunmamaktadır.";
      } else if (finalScore >= 75) {
        statusMsg = "Sistem durumunuz genel olarak iyi. Ancak daha pürüzsüz bir kullanıcı deneyimi için birkaç iyileştirme yapılabilir.";
      } else {
        statusMsg = "Sistem sağlığında bazı kritik aksamalar veya test edilmemiş alanlar var. Lütfen önerilen adımları uygulayın.";
      }

      setDiagReport({
        status: statusMsg,
        metrics,
        suggestions: suggestions.length > 0 ? suggestions : ["Tüm kontroller tamamlandı, şu an için ek öneri bulunmuyor. Harika iş!"]
      });
      setDiagState('success');
    }, 150); // Fast transition delay of 150ms instead of artificial 1.5s delay
  };

  const runDbTest = async () => {
    setDbTestState('running');
    setDbError(null);
    const start = performance.now();
    try {
      const q = query(collection(db, 'config'), limit(1));
      await getDocs(q);
      const latency = Math.round(performance.now() - start);
      setDbLatency(latency);
      setDbTestState('success');
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || 'Firestore bağlantı hatası');
      setDbTestState('error');
    }
  };

  const runFcmTest = async () => {
    setFcmTestState('running');
    try {
      const permission = typeof window !== 'undefined' ? Notification.permission : 'default';
      setFcmPermission(permission);
      let swActive = false;
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        swActive = regs.length > 0;
      }
      setFcmSwActive(swActive);
      setFcmTestState('success');
    } catch (err) {
      setFcmTestState('error');
    }
  };

  const runPwaTest = async () => {
    setPwaTestState('running');
    try {
      const offlineCapable = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
      setPwaOfflineCapable(offlineCapable);
      let cacheSizeStr = 'Desteklenmiyor';
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        cacheSizeStr = `${keys.length} Aktif Önbellek Deposu`;
      }
      setPwaCacheSize(cacheSizeStr);
      setPwaTestState('success');
      checkSwUpdate();
    } catch (err) {
      setPwaTestState('error');
    }
  };

  const runNetworkTest = async () => {
    setNetworkTestState('running');
    const start = performance.now();
    try {
      await fetch(window.location.origin + '/favicon.ico', { method: 'HEAD', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      setNetworkLatency(latency);
      setNetworkTestState('success');
    } catch (err) {
      setNetworkTestState('error');
    }
  };

  const executeSimulateError = () => {
    setConfirmSimulateOpen(false);
    setTimeout(() => {
      throw new Error(`Sistem Teşhisi Simülasyon Hatası - Saat: ${new Date().toLocaleTimeString('tr-TR')}`);
    }, 50);
    setActiveTab('errors');
  };

  return (
    <div className="space-y-8">
      {/* Intro Banner */}
      <div className="spatial-glass border border-[var(--glass-border)] p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] bg-gradient-to-r from-[var(--text-primary)]/[0.01] to-[var(--dynamic-aura,var(--aura-indigo))]/[0.02] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
        <div className="space-y-1">
          <span className="premium-label !text-[8px] text-[var(--dynamic-aura,var(--aura-indigo))] font-bold tracking-wide uppercase flex items-center gap-1.5">
            <Sparkles size={10} className="text-[var(--dynamic-aura,var(--aura-indigo))] animate-pulse" /> SİSTEM SAĞLIK MODÜLÜ
          </span>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">İnteraktif Sistem Teşhis Paneli</h4>
          <p className="text-xs text-[var(--text-secondary)]/60 max-w-xl leading-relaxed">
            Uygulamanın kritik altyapı katmanlarını, veritabanı okuma verimliliğini ve senkronizasyon durumunu gerçek zamanlı test edin.
          </p>
        </div>
      </div>

      {/* Self-Check Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Firestore DB check */}
        <motion.div
          layout
          className={`spatial-glass border p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
            dbTestState === 'success' ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.03)]' :
            dbTestState === 'error' ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.03)]' :
            'border-[var(--glass-border)]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${
                dbTestState === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                dbTestState === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-[var(--dynamic-aura,var(--aura-indigo))]'
              }`}>
                <Database size={18} />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">Veritabanı Katmanı</h5>
                <p className="text-[10px] text-[var(--text-secondary)]/50">Firestore DB Bağlantı Durumu</p>
              </div>
            </div>
            
            <div>
              {dbTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[8px] font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {dbTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {dbTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">AKTİF <CheckCircle2 size={10} /></span>}
              {dbTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-[8px] font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">ÇEVRİMDIŞI <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-secondary)]/60">Canlı Veri Abonelikleri (onSnapshot):</span>
                <span className={`font-semibold ${activeListeners > 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {activeListeners} Aktif Dinleyici
                </span>
              </div>
              {dbTestState === 'success' && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">DB Yanıt Süresi:</span>
                  <span className="font-semibold text-emerald-400">{dbLatency} ms</span>
                </div>
              )}
            </div>
            {dbTestState === 'error' && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-[10px] font-mono text-rose-400/90 leading-relaxed overflow-y-auto max-h-16">
                Hata: {dbError}
              </div>
            )}
            {dbTestState === 'idle' && (
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed font-light">
                Veritabanı bağlantı hızını ve canlı veri kanallarındaki toplam listener yükünü anlık denetler.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={runDbTest}
            disabled={dbTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {dbTestState === 'running' ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
          </motion.button>
        </motion.div>

        {/* 2. FCM & Push Alerts check */}
        <motion.div
          layout
          className={`spatial-glass border p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
            fcmTestState === 'success' ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.03)]' :
            fcmTestState === 'error' ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.03)]' :
            'border-[var(--glass-border)]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${
                fcmTestState === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                fcmTestState === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-amber-500'
              }`}>
                <BellRing size={18} />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">Bildirim Servisleri</h5>
                <p className="text-[10px] text-[var(--text-secondary)]/50">FCM ve Push API Uyumluluğu</p>
              </div>
            </div>

            <div>
              {fcmTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[8px] font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {fcmTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {fcmTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">TAMAM <CheckCircle2 size={10} /></span>}
              {fcmTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-[8px] font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">HATA <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            {fcmTestState === 'success' && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Tarayıcı İzni:</span>
                  <span className={`font-semibold uppercase ${fcmPermission === 'granted' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fcmPermission === 'granted' ? 'İzin Verildi' : fcmPermission === 'denied' ? 'Reddedildi' : 'Varsayılan/Sorgu'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Service Worker Entegrasyonu:</span>
                  <span className={`font-semibold ${fcmSwActive ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {fcmSwActive ? 'Kayıtlı & Aktif' : 'Bulunamadı / PWA Yüklü Değil'}
                  </span>
                </div>
              </div>
            )}
            {fcmTestState === 'idle' && (
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed font-light">
                Tarayıcı anlık bildirim izinlerini sorgular. Görev uyarısı dağıtımları için kritiktir.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={runFcmTest}
            disabled={fcmTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {fcmTestState === 'running' ? 'Sorgulanıyor...' : 'İzinleri Denetle'}
          </motion.button>
        </motion.div>

        {/* 3. PWA Standalone check & Update Checker */}
        <motion.div
          layout
          className={`spatial-glass border p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
            pwaTestState === 'success' ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.03)]' :
            'border-[var(--glass-border)]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${
                pwaTestState === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-purple-400'
              }`}>
                <Layers size={18} />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">PWA ve Sürüm Kontrolü</h5>
                <p className="text-[10px] text-[var(--text-secondary)]/50">Çevrimdışı Çalışma Kabiliyeti</p>
              </div>
            </div>

            <div>
              {pwaTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[8px] font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {pwaTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {pwaTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">TAMAM <CheckCircle2 size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            {pwaTestState === 'success' && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Offline Desteği:</span>
                  <span className={`font-semibold ${pwaOfflineCapable ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pwaOfflineCapable ? 'Aktif (SW Var)' : 'Desteklenmiyor'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Güncelleme Durumu:</span>
                  <span className={`font-semibold ${swUpdateWaiting ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {swUpdateWaiting ? 'Yeni Sürüm Hazır (Sayfayı Yenileyin)' : 'Uygulama Güncel'}
                  </span>
                </div>
              </div>
            )}
            {pwaTestState === 'idle' && (
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed font-light">
                Çevrimdışı önbellek durumunu denetler ve arka planda yeni bir güncelleme paketi olup olmadığını sorgular.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={runPwaTest}
              disabled={pwaTestState === 'running'}
              className="flex-1 py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {pwaTestState === 'running' ? 'Denetleniyor...' : 'PWA Denetle'}
            </motion.button>
            {pwaTestState === 'success' && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={checkSwUpdate}
                disabled={checkingUpdate}
                className="px-3 py-3 bg-[var(--dynamic-aura,var(--aura-indigo))]/10 border border-[var(--dynamic-aura,var(--aura-indigo))]/20 text-[var(--dynamic-aura,var(--aura-indigo))] rounded-xl text-[9px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Yeni Sürümü Kontrol Et"
              >
                <RefreshCw size={11} className={checkingUpdate ? 'animate-spin' : ''} />
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* 4. Network and Outbox check */}
        <motion.div
          layout
          className={`spatial-glass border p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
            networkTestState === 'success' ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.03)]' :
            networkTestState === 'error' ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.03)]' :
            'border-[var(--glass-border)]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${
                networkTestState === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                networkTestState === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-sky-400'
              }`}>
                <Wifi size={18} />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">Ağ & Çevrimdışı Eşitleme</h5>
                <p className="text-[10px] text-[var(--text-secondary)]/50">Veri Senkronizasyon Kuyruğu</p>
              </div>
            </div>

            <div>
              {networkTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[8px] font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {networkTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {networkTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">TAMAM <CheckCircle2 size={10} /></span>}
              {networkTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-[8px] font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">HATA <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-secondary)]/60">Eşitleme Kuyruğu (Outbox):</span>
                <span className={`font-semibold ${syncState === 'pending' ? 'text-amber-400 font-bold animate-pulse' : syncState === 'checking' ? 'text-[var(--text-secondary)]/50' : 'text-emerald-400'}`}>
                  {syncState === 'pending' ? 'Eşitleme Bekleyen İşlemler Var' : syncState === 'checking' ? 'Sorgulanıyor...' : 'Tüm Veriler Eşitlendi ✓'}
                </span>
              </div>
              {networkTestState === 'success' && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Ping Gecikmesi:</span>
                  <span className={`font-semibold ${networkLatency !== null && networkLatency < 100 ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {networkLatency} ms
                  </span>
                </div>
              )}
            </div>
            {networkTestState === 'idle' && (
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed font-light">
                Cihazın internet gecikmesini test eder ve Firebase'e yazılmış ancak henüz sunucuya ulaşmamış bekleyen çevrimdışı işlemleri doğrular.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => { runNetworkTest(); runSyncCheck(); }}
            disabled={networkTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {networkTestState === 'running' ? 'Ping Ölçülüyor...' : 'Ağ ve Kuyruğu Sorgula'}
          </motion.button>
        </motion.div>
      </div>

      {/* Autonomous Diagnostics Panel */}
      <div className="spatial-glass border border-[var(--dynamic-aura,var(--aura-indigo))]/20 p-4 sm:p-8 rounded-[20px] sm:rounded-[32px] bg-gradient-to-br from-[var(--dynamic-aura,var(--aura-indigo))]/[0.03] to-purple-500/[0.03] relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--dynamic-aura,var(--aura-indigo))]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--dynamic-aura,var(--aura-indigo))]/10 border border-[var(--dynamic-aura,var(--aura-indigo))]/20 flex items-center justify-center text-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_20px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_15%,transparent)]">
              <Sparkles size={22} className="text-[var(--dynamic-aura,var(--aura-indigo))]" />
            </div>
            <div>
              <span className="premium-label !text-[8px] text-purple-400 font-bold tracking-wide uppercase flex items-center gap-1">
                <Sparkles size={10} className="text-purple-400 animate-pulse" /> SİSTEM SAĞLIĞI ANALİZİ
              </span>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Otonom Sağlık Teşhis Motoru</h4>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={runHealthDiagnostics}
            disabled={diagState === 'running'}
            className="px-6 py-3.5 bg-gradient-to-r from-[var(--dynamic-aura,var(--aura-indigo))] to-purple-500/60 text-white hover:opacity-95 rounded-2xl text-[9px] font-bold uppercase tracking-wide shadow-lg shadow-[color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_10%,transparent)] flex items-center gap-2.5 transition-all disabled:opacity-50"
          >
            {diagState === 'running' ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                ANALİZ HESAPLANIYOR...
              </>
            ) : (
              <>
                <Sparkles size={12} />
                SAĞLIK TEŞHİSİNİ ÇALIŞTIR
              </>
            )}
          </motion.button>
        </div>

        {diagState === 'idle' && (
          <div className="p-6 bg-white/[0.01] border border-[var(--glass-border)] rounded-2xl flex flex-col items-center justify-center text-center py-10 space-y-3">
            <span className="text-[11px] text-[var(--text-secondary)]/50 max-w-md leading-relaxed font-light">
              Firestore DB gecikmelerini, aktif dinleyicileri ve ağ ping verilerini değerlendirerek gerçek zamanlı sistem sağlığı analiz raporu oluşturmak için yukarıdaki butona tıklayın.
            </span>
          </div>
        )}

        {diagState === 'running' && (
          <div className="p-8 bg-white/[0.01] border border-[var(--glass-border)] rounded-2xl flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-[var(--dynamic-aura,var(--aura-indigo))]/10 border-t-[var(--dynamic-aura,var(--aura-indigo))] animate-spin" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--dynamic-aura,var(--aura-indigo))]">
                <Sparkles size={16} className="animate-pulse" />
              </div>
            </div>
            <p className="text-[9px] font-bold text-[var(--dynamic-aura,var(--aura-indigo))] uppercase tracking-wide animate-pulse">Sistem Telemetrisi Değerlendiriliyor...</p>
          </div>
        )}

        {diagState === 'success' && diagReport && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Score & Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Score ring */}
              <div className="spatial-glass border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden bg-white/[0.01] min-h-[180px]">
                <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">SİSTEM SAĞLIK SKORU</span>
                <div className="relative flex items-center justify-center w-24 h-24">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="38"
                      className="text-white/[0.03]"
                      strokeWidth="6"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="48"
                      cy="48"
                      r="38"
                      strokeWidth="6"
                      stroke={
                        diagScore >= 90 ? 'var(--status-success)' :
                        diagScore >= 70 ? 'var(--status-warning)' : 'var(--status-danger)'
                      }
                      strokeDasharray="238.76"
                      initial={{ strokeDashoffset: 238.76 }}
                      animate={{ strokeDashoffset: 238.76 - (238.76 * diagScore) / 100 }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className={`text-2xl font-extrabold tracking-tight ${
                      diagScore >= 90 ? 'text-emerald-400' :
                      diagScore >= 70 ? 'text-amber-400' : 'text-rose-400'
                    }`}>{diagScore}</span>
                    <span className="text-[7.5px] text-[var(--text-secondary)]/30 font-bold uppercase tracking-widest mt-0.5">Skor</span>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="md:col-span-2 spatial-glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] flex items-center h-full">
                <p className="text-xs text-[var(--text-primary)]/80 leading-relaxed font-medium">
                  {diagReport.status}
                </p>
              </div>
            </div>

            {/* Metrics vs Suggestions Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Telemetry Metrics */}
              <div className="space-y-3">
                <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">GERÇEK TELEMETRİ VERİLERİ</span>
                <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-2.5">
                  {diagReport.metrics.map((metric, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-[var(--text-primary)]/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--dynamic-aura,var(--aura-indigo))]/50" />
                      <span className="font-light">{metric}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggestions */}
              <div className="space-y-3">
                <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">EYLEM TAVSİYELERİ</span>
                <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-2.5">
                  {diagReport.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                      <Sparkles size={12} className="text-purple-400 mt-0.5 shrink-0" />
                      <span className="font-light">{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Device & Session Specs */}
      <div className="spatial-glass border border-[var(--glass-border)] p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--glass-border)] pb-3">
          <Info size={16} className="text-[var(--dynamic-aura,var(--aura-indigo))]" />
          <h5 className="text-xs font-semibold text-[var(--text-primary)]">İstemci ve Tarayıcı Sağlık Detayları</h5>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">İşletim Sistemi</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{typeof navigator !== 'undefined' ? ((navigator as any).userAgentData?.platform || navigator.platform || 'Algılanamadı') : 'Bilinmiyor'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">Ekran Çözünürlüğü</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Bilinmiyor'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">Çevrimiçi Durumu</span>
            <span className={`text-xs font-bold uppercase ${typeof navigator !== 'undefined' && navigator.onLine ? 'text-emerald-400' : 'text-rose-400'}`}>
              {typeof navigator !== 'undefined' && navigator.onLine ? 'BAĞLI' : 'ÇEVRİMDIŞI'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">Dil / Yerel Ayar</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{typeof navigator !== 'undefined' ? navigator.language : 'tr-TR'}</span>
          </div>
        </div>
      </div>

      {/* 🛠️ Developer Sandbox Panel (Collapsible Accordion) */}
      <div className="spatial-glass border border-[var(--glass-border)] rounded-[20px] sm:rounded-[28px] overflow-hidden">
        <button
          onClick={() => setShowSandbox(!showSandbox)}
          className="w-full p-4 sm:p-5 flex items-center justify-between bg-white/[0.01] hover:bg-white/[0.02] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <Terminal size={16} className="text-[var(--text-secondary)]/50" />
            <h5 className="text-xs font-semibold text-[var(--text-secondary)]/70">🛠️ Geliştirici Sandbox & Test Araçları</h5>
          </div>
          <div className="text-[var(--text-secondary)]/40">
            {showSandbox ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>
        
        <AnimatePresence>
          {showSandbox && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-[var(--glass-border)] bg-black/10 p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--surface-low)] p-4 rounded-2xl border border-[var(--glass-border)]">
                <div className="space-y-1">
                  <h6 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert size={13} /> React Error Boundary & Hata Günlüğü Testi
                  </h6>
                  <p className="text-[10px] text-[var(--text-secondary)]/60 leading-relaxed font-light max-w-xl">
                    Bu araç, sistem hata kayıt altyapısını test etmek için yapay bir Javascript hatası fırlatır. Hata fırlatıldığında uygulama hatayı yakalayarak Firestore loglarına yazacak ve sizi hata izleme sekmesine yönlendirecektir.
                  </p>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setConfirmSimulateOpen(true)}
                  className="px-4 py-3.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-[8.5px] font-bold uppercase tracking-wider shadow-md flex items-center gap-2 transition-all whitespace-nowrap self-end sm:self-center"
                >
                  <Play size={10} /> Hata Simüle Et
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmModal
        isOpen={confirmSimulateOpen}
        onClose={() => setConfirmSimulateOpen(false)}
        onConfirm={executeSimulateError}
        title="TEST HATASI SİMÜLASYONU"
        message="Uygulamada yapay bir çökme simüle edilecek ve hata günlüklerine yeni bir kayıt yazılacaktır. Devam etmek istiyor musunuz?"
        isDanger={true}
        confirmText="EVET, SİMÜLE ET"
      />
    </div>
  );
});
SistemTestleriSekmesi.displayName = 'SistemTestleriSekmesi';
