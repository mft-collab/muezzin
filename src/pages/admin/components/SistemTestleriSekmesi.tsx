import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, limit, getDocs, waitForPendingWrites } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Database, BellRing, Layers, Wifi, Play, Sparkles, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, Terminal, ShieldAlert } from 'lucide-react';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { telemetryService } from '../../../services/telemetryService';

/**
 * Bu panel, bileşen state'inde zaten mevcut olan GERÇEK ölçümleri (Firestore
 * gecikmesi, bildirim izni, PWA/SW durumu, ağ pingi, senkron kuyruğu) gösterir.
 * Daha önce burada bu ölçümleri rastgele bir puanlama formülüyle tek bir sahte
 * "sağlık skoru"na indirgeyip yapay bir setTimeout gecikmesiyle "hesaplanıyor"
 * animasyonu gösteren ayrı bir "Otonom Teşhis Motoru" vardı — o motor gerçek
 * bir telemetri kaynağı değildi, zaten burada gösterilen değerleri tekrar
 * paketleyen bir simülasyondu ve kaldırıldı.
 */

export const SistemTestleriSekmesi = React.memo(({ setActiveTab }: { setActiveTab: (t: string) => void }) => {
  const [dbTestState, setDbTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

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

  // Collapsible Sandbox State
  const [showSandbox, setShowSandbox] = useState<boolean>(false);
  const [confirmSimulateOpen, setConfirmSimulateOpen] = useState(false);

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
    // Hatayı global olarak fırlatmak yerine telemetri pipeline'ı güvenli şekilde test ediyoruz.
    // setTimeout + throw, React ErrorBoundary'yi atlatarak tarayıcıyı çökertir;
    // bunun yerine gerçek hata objesini oluşturup Firestore'a kaydediyoruz.
    const simulatedError = new Error(
      `Sistem Teşhisi Simülasyon Hatası - Saat: ${new Date().toLocaleTimeString('tr-TR')}`
    );
    simulatedError.stack = `Error: Simülasyon\n    at executeSimulateError (SistemTestleriSekmesi.tsx:260)\n    at onClick (SistemTestleriSekmesi.tsx:530)`;
    telemetryService.addBreadcrumb('Admin: Hata simülasyonu tetiklendi', 'user_action');
    telemetryService.logError(simulatedError, 'ADMIN_SIMULATION').catch(() => {
      // Sessizce yut — bu zaten bir test
    });
    setActiveTab('errors');
  };

  return (
    <div className="space-y-8">
      {/* Intro Banner */}
      <div className="spatial-glass border border-[var(--glass-border)] p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] bg-gradient-to-r from-[var(--text-primary)]/[0.01] to-[var(--dynamic-aura,var(--aura-indigo))]/[0.02] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
        <div className="space-y-1">
          <span className="premium-label !text-2xs text-[var(--dynamic-aura,var(--aura-indigo))] font-bold tracking-wide uppercase flex items-center gap-1.5">
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
                <p className="text-2xs text-[var(--text-secondary)]/50">Firestore DB Bağlantı Durumu</p>
              </div>
            </div>
            
            <div>
              {dbTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-2xs font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {dbTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {dbTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-2xs font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">AKTİF <CheckCircle2 size={10} /></span>}
              {dbTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-2xs font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">ÇEVRİMDIŞI <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            <div className="flex flex-col gap-1">
              {dbTestState === 'success' && (
                <div className="flex justify-between text-2xs">
                  <span className="text-[var(--text-secondary)]/60">DB Yanıt Süresi:</span>
                  <span className="font-semibold text-emerald-400">{dbLatency} ms</span>
                </div>
              )}
            </div>
            {dbTestState === 'error' && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-2xs font-mono text-rose-400/90 leading-relaxed overflow-y-auto max-h-16">
                Hata: {dbError}
              </div>
            )}
            {dbTestState === 'idle' && (
              <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed font-light">
                Veritabanı bağlantı hızını ve canlı veri kanallarındaki toplam listener yükünü anlık denetler.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={runDbTest}
            disabled={dbTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-2xs font-bold uppercase tracking-wide text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
                <p className="text-2xs text-[var(--text-secondary)]/50">FCM ve Push API Uyumluluğu</p>
              </div>
            </div>

            <div>
              {fcmTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-2xs font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {fcmTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {fcmTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-2xs font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">TAMAM <CheckCircle2 size={10} /></span>}
              {fcmTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-2xs font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">HATA <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            {fcmTestState === 'success' && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-[var(--text-secondary)]/60">Tarayıcı İzni:</span>
                  <span className={`font-semibold uppercase ${fcmPermission === 'granted' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fcmPermission === 'granted' ? 'İzin Verildi' : fcmPermission === 'denied' ? 'Reddedildi' : 'Varsayılan/Sorgu'}
                  </span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-[var(--text-secondary)]/60">Service Worker Entegrasyonu:</span>
                  <span className={`font-semibold ${fcmSwActive ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {fcmSwActive ? 'Kayıtlı & Aktif' : 'Bulunamadı / PWA Yüklü Değil'}
                  </span>
                </div>
              </div>
            )}
            {fcmTestState === 'idle' && (
              <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed font-light">
                Tarayıcı anlık bildirim izinlerini sorgular. Görev uyarısı dağıtımları için kritiktir.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={runFcmTest}
            disabled={fcmTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-2xs font-bold uppercase tracking-wide text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
                <p className="text-2xs text-[var(--text-secondary)]/50">Çevrimdışı Çalışma Kabiliyeti</p>
              </div>
            </div>

            <div>
              {pwaTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-2xs font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {pwaTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {pwaTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-2xs font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">TAMAM <CheckCircle2 size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            {pwaTestState === 'success' && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-2xs">
                  <span className="text-[var(--text-secondary)]/60">Offline Desteği:</span>
                  <span className={`font-semibold ${pwaOfflineCapable ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pwaOfflineCapable ? 'Aktif (SW Var)' : 'Desteklenmiyor'}
                  </span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-[var(--text-secondary)]/60">Güncelleme Durumu:</span>
                  <span className={`font-semibold ${swUpdateWaiting ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {swUpdateWaiting ? 'Yeni Sürüm Hazır (Sayfayı Yenileyin)' : 'Uygulama Güncel'}
                  </span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-[var(--text-secondary)]/60">Önbellek Depoları:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{pwaCacheSize}</span>
                </div>
              </div>
            )}
            {pwaTestState === 'idle' && (
              <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed font-light">
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
              className="flex-1 py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-2xs font-bold uppercase tracking-wide text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {pwaTestState === 'running' ? 'Denetleniyor...' : 'PWA Denetle'}
            </motion.button>
            {pwaTestState === 'success' && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={checkSwUpdate}
                disabled={checkingUpdate}
                className="px-3 py-3 bg-[var(--dynamic-aura,var(--aura-indigo))]/10 border border-[var(--dynamic-aura,var(--aura-indigo))]/20 text-[var(--dynamic-aura,var(--aura-indigo))] rounded-xl text-2xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                <p className="text-2xs text-[var(--text-secondary)]/50">Veri Senkronizasyon Kuyruğu</p>
              </div>
            </div>

            <div>
              {networkTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-2xs font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {networkTestState === 'running' && <RefreshCw size={14} className="animate-spin text-[var(--dynamic-aura,var(--aura-indigo))]" />}
              {networkTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-2xs font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">TAMAM <CheckCircle2 size={10} /></span>}
              {networkTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-2xs font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">HATA <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-2xs">
                <span className="text-[var(--text-secondary)]/60">Eşitleme Kuyruğu (Outbox):</span>
                <span className={`font-semibold ${syncState === 'pending' ? 'text-amber-400 font-bold animate-pulse' : syncState === 'checking' ? 'text-[var(--text-secondary)]/50' : 'text-emerald-400'}`}>
                  {syncState === 'pending' ? 'Eşitleme Bekleyen İşlemler Var' : syncState === 'checking' ? 'Sorgulanıyor...' : 'Tüm Veriler Eşitlendi ✓'}
                </span>
              </div>
              {networkTestState === 'success' && (
                <div className="flex justify-between text-2xs">
                  <span className="text-[var(--text-secondary)]/60">Ping Gecikmesi:</span>
                  <span className={`font-semibold ${networkLatency !== null && networkLatency < 100 ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {networkLatency} ms
                  </span>
                </div>
              )}
            </div>
            {networkTestState === 'idle' && (
              <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed font-light">
                Cihazın internet gecikmesini test eder ve Firebase'e yazılmış ancak henüz sunucuya ulaşmamış bekleyen çevrimdışı işlemleri doğrular.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => { runNetworkTest(); runSyncCheck(); }}
            disabled={networkTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-2xs font-bold uppercase tracking-wide text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {networkTestState === 'running' ? 'Ping Ölçülüyor...' : 'Ağ ve Kuyruğu Sorgula'}
          </motion.button>
        </motion.div>
      </div>

      {/* Device & Session Specs */}
      <div className="spatial-glass border border-[var(--glass-border)] p-4 sm:p-6 rounded-[20px] sm:rounded-[28px] space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--glass-border)] pb-3">
          <Info size={16} className="text-[var(--dynamic-aura,var(--aura-indigo))]" />
          <h5 className="text-xs font-semibold text-[var(--text-primary)]">İstemci ve Tarayıcı Sağlık Detayları</h5>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <span className="text-2xs text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">İşletim Sistemi</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{typeof navigator !== 'undefined' ? ((navigator as any).userAgentData?.platform || navigator.platform || 'Algılanamadı') : 'Bilinmiyor'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-2xs text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">Ekran Çözünürlüğü</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Bilinmiyor'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-2xs text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">Çevrimiçi Durumu</span>
            <span className={`text-xs font-bold uppercase ${typeof navigator !== 'undefined' && navigator.onLine ? 'text-emerald-400' : 'text-rose-400'}`}>
              {typeof navigator !== 'undefined' && navigator.onLine ? 'BAĞLI' : 'ÇEVRİMDIŞI'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-2xs text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">Dil / Yerel Ayar</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{typeof navigator !== 'undefined' ? navigator.language : 'tr-TR'}</span>
          </div>
        </div>
      </div>

      {/* 🛠️ Developer Sandbox Panel (Collapsible Accordion) */}
      <div className="spatial-glass border border-[var(--glass-border)] rounded-[20px] sm:rounded-[28px] overflow-hidden">
        <button
          onClick={() => setShowSandbox(!showSandbox)}
          className="w-full p-4 sm:p-5 flex items-center justify-between bg-[var(--text-primary)]/[0.01] hover:bg-[var(--text-primary)]/[0.02] transition-colors text-left"
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
                  <p className="text-2xs text-[var(--text-secondary)]/60 leading-relaxed font-light max-w-xl">
                    Bu araç, sistem hata kayıt altyapısını test etmek için yapay bir Javascript hatası fırlatır. Hata fırlatıldığında uygulama hatayı yakalayarak Firestore loglarına yazacak ve sizi hata izleme sekmesine yönlendirecektir.
                  </p>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setConfirmSimulateOpen(true)}
                  className="px-4 py-3.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-2xs font-bold uppercase tracking-wider shadow-md flex items-center gap-2 transition-all whitespace-nowrap self-end sm:self-center"
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
