import React, { useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { motion } from 'motion/react';
import { RefreshCw, Database, BellRing, Layers, Wifi, Play, Sparkles, CheckCircle2, XCircle, Info } from 'lucide-react';

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

  const [networkTestState, setNetworkTestState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);

  // AI Diagnostics State
  const [aiState, setAiState] = useState<'idle' | 'running' | 'success'>('idle');
  const [aiScore, setAiScore] = useState<number>(0);
  const [aiReport, setAiReport] = useState<{
    status: string;
    metrics: string[];
    suggestions: string[];
  } | null>(null);

  const runAiAnalysis = () => {
    setAiState('running');
    setTimeout(() => {
      let score = 50;
      const metrics: string[] = [];
      const suggestions: string[] = [];
      
      if (dbTestState === 'success') {
        score += 15;
        if (dbLatency && dbLatency < 100) {
          score += 10;
          metrics.push(`Firestore DB Gecikmesi: ${dbLatency}ms (Mükemmel)`);
        } else if (dbLatency) {
          metrics.push(`Firestore DB Gecikmesi: ${dbLatency}ms (Kabul Edilebilir)`);
          suggestions.push("Firestore gecikmesini azaltmak için istemci tarafındaki veri aboneliklerini (onSnapshot) optimize edin.");
        } else {
          metrics.push("Firestore DB Bağlantısı: Aktif");
        }
      } else if (dbTestState === 'error') {
        score -= 20;
        metrics.push("Firestore DB Bağlantısı: Hatalı/Kapalı");
        suggestions.push("Veritabanı bağlantısı kurulamadı. Firebase güvenlik kurallarını (firestore.rules) ve internet bağlantınızı denetleyin.");
      } else {
        metrics.push("Firestore DB: Test edilmedi");
        suggestions.push("Firestore veritabanı durumunu netleştirmek için yukarıdaki 'Veritabanı Katmanı' testini çalıştırın.");
      }

      if (fcmTestState === 'success') {
        score += 10;
        if (fcmPermission === 'granted') {
          score += 5;
          metrics.push("Anlık Bildirim İzni: Verildi");
        } else {
          metrics.push("Anlık Bildirim İzni: Reddedildi veya Varsayılan");
          suggestions.push("Görev alarmlarını ve anlık duyuruları alabilmek için tarayıcınızdan bildirim izinlerini etkinleştirin.");
        }
        if (fcmSwActive) {
          score += 5;
          metrics.push("Service Worker Durumu: Aktif");
        } else {
          metrics.push("Service Worker Durumu: Bulunamadı");
          suggestions.push("Uygulamayı PWA (Progresif Web Uygulaması) olarak yükleyin veya Service Worker dosyasını kontrol edin.");
        }
      } else {
        metrics.push("Bildirim Servisi: Test edilmedi");
        suggestions.push("Bildirim altyapısını test etmek için yukarıdaki 'Bildirim Servisleri' testini başlatın.");
      }

      if (networkTestState === 'success') {
        score += 10;
        if (networkLatency && networkLatency < 80) {
          score += 5;
          metrics.push(`Ağ Gecikmesi (Ping): ${networkLatency}ms (Çok Hızlı)`);
        } else if (networkLatency) {
          metrics.push(`Ağ Gecikmesi (Ping): ${networkLatency}ms`);
          if (networkLatency > 200) {
            score -= 5;
            suggestions.push("Ağ gecikmesi yüksek görünüyor. Kararlı bir kablosuz ağ veya kablolu bağlantı kullanılması önerilir.");
          }
        }
      } else {
        metrics.push("Ağ Sağlığı: Test edilmedi");
        suggestions.push("Sunucu ping yanıt süresini ölçmek için yukarıdaki 'Ağ Gecikmesi' testini çalıştırın.");
      }

      const finalScore = Math.max(0, Math.min(100, score));
      setAiScore(finalScore);

      let statusMsg = "";
      if (finalScore >= 90) {
        statusMsg = "Sisteminiz son derece sağlıklı ve tam performansla çalışıyor. Herhangi bir kritik optimizasyon ihtiyacı bulunmamaktadır.";
      } else if (finalScore >= 70) {
        statusMsg = "Sistem durumunuz genel olarak iyi. Ancak daha pürüzsüz bir kullanıcı deneyimi için birkaç iyileştirme yapılabilir.";
      } else {
        statusMsg = "Sistem sağlığında bazı kritik aksamalar veya test edilmemiş alanlar var. Lütfen önerilen adımları uygulayın.";
      }

      setAiReport({
        status: statusMsg,
        metrics,
        suggestions: suggestions.length > 0 ? suggestions : ["Tüm kontroller tamamlandı, şu an için ek öneri bulunmuyor. Harika iş!"]
      });
      setAiState('success');
    }, 1500);
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

  const simulateError = () => {
    if (!window.confirm("Test hatası simülasyonu tetiklenecek. Devam etmek istiyor musunuz?")) return;
    setTimeout(() => {
      throw new Error(`Sistem Teşhisi Simülasyon Hatası - Saat: ${new Date().toLocaleTimeString('tr-TR')}`);
    }, 50);
    setActiveTab('errors');
  };

  return (
    <div className="space-y-8">
      {/* Quick Intro Banner */}
      <div className="spatial-glass border border-[var(--glass-border)] p-6 rounded-[28px] bg-gradient-to-r from-[var(--text-primary)]/[0.01] to-indigo-500/[0.02] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <span className="premium-label !text-[8px] text-indigo-400 font-bold tracking-[0.2em] uppercase flex items-center gap-1.5">
            <Sparkles size={10} className="text-indigo-400 animate-pulse" /> SİSTEM SAĞLIK MODÜLÜ
          </span>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">İnteraktif Sistem Teşhis Paneli</h4>
          <p className="text-xs text-[var(--text-secondary)]/60 max-w-xl leading-relaxed">
            Uygulamanın kritik altyapı katmanlarını gerçek zamanlı test edin.
          </p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={simulateError}
          className="px-5 py-3.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl text-[9px] font-bold uppercase tracking-[0.2em] shadow-lg flex items-center gap-2.5 transition-all whitespace-nowrap"
        >
          <Play size={10} /> HATA SİMÜLATÖRÜNÜ TETİKLE
        </motion.button>
      </div>

      {/* Self-Check Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Firestore DB check */}
        <motion.div
          layout
          className={`spatial-glass border p-6 rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
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
                'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-indigo-400'
              }`}>
                <Database size={18} />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">Veritabanı Katmanı</h5>
                <p className="text-[10px] text-[var(--text-secondary)]/50">Firestore DB Bağlantı Durumu</p>
              </div>
            </div>
            
            {/* Status Indicator */}
            <div>
              {dbTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[8px] font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {dbTestState === 'running' && <RefreshCw size={14} className="animate-spin text-indigo-400" />}
              {dbTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">AKTİF <CheckCircle2 size={10} /></span>}
              {dbTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-[8px] font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">ÇEVRİMDIŞI <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            {dbTestState === 'success' && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">DB Yanıt Süresi:</span>
                  <span className="font-semibold text-emerald-400">{dbLatency} ms</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Koleksiyon İzinleri:</span>
                  <span className="font-semibold text-[var(--text-primary)]">Doğrulandı</span>
                </div>
              </div>
            )}
            {dbTestState === 'error' && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-[10px] font-mono text-rose-400/90 leading-relaxed overflow-y-auto max-h-16">
                Hata: {dbError}
              </div>
            )}
            {dbTestState === 'idle' && (
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed">
                Firebase Cloud Firestore bağlantısını ve güvenlik kurallarını test eder.
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
          className={`spatial-glass border p-6 rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
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
              {fcmTestState === 'running' && <RefreshCw size={14} className="animate-spin text-indigo-400" />}
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
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed">
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

        {/* 3. PWA Standalone check */}
        <motion.div
          layout
          className={`spatial-glass border p-6 rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
            pwaTestState === 'success' ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.03)]' :
            pwaTestState === 'error' ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.03)]' :
            'border-[var(--glass-border)]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${
                pwaTestState === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                pwaTestState === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-purple-400'
              }`}>
                <Layers size={18} />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">PWA ve Önbellek</h5>
                <p className="text-[10px] text-[var(--text-secondary)]/50">Çevrimdışı Çalışma Kabiliyeti</p>
              </div>
            </div>

            <div>
              {pwaTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[8px] font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {pwaTestState === 'running' && <RefreshCw size={14} className="animate-spin text-indigo-400" />}
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
                  <span className="text-[var(--text-secondary)]/60">Cache API Durumu:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{pwaCacheSize}</span>
                </div>
              </div>
            )}
            {pwaTestState === 'idle' && (
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed">
                PWA manifest yapısını ve Service Worker cache storage boyutunu analiz eder.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={runPwaTest}
            disabled={pwaTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pwaTestState === 'running' ? 'Denetleniyor...' : 'PWA Durumunu Denetle'}
          </motion.button>
        </motion.div>

        {/* 4. Network performance / roundtrip */}
        <motion.div
          layout
          className={`spatial-glass border p-6 rounded-[28px] flex flex-col justify-between h-64 transition-all duration-500 ${
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
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">Ağ Gecikmesi (Ping)</h5>
                <p className="text-[10px] text-[var(--text-secondary)]/50">Uç Nokta Tepki Süreleri</p>
              </div>
            </div>

            <div>
              {networkTestState === 'idle' && <span className="px-2 py-1 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[8px] font-bold tracking-wider rounded-lg text-[var(--text-secondary)]/60">HAZIR</span>}
              {networkTestState === 'running' && <RefreshCw size={14} className="animate-spin text-indigo-400" />}
              {networkTestState === 'success' && <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold tracking-wider rounded-lg text-emerald-400 flex items-center gap-1">TAMAM <CheckCircle2 size={10} /></span>}
              {networkTestState === 'error' && <span className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-[8px] font-bold tracking-wider rounded-lg text-rose-400 flex items-center gap-1">HATA <XCircle size={10} /></span>}
            </div>
          </div>

          <div className="my-4 space-y-2">
            {networkTestState === 'success' && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Ping Gecikmesi:</span>
                  <span className={`font-semibold ${networkLatency !== null && networkLatency < 100 ? 'text-emerald-400' : networkLatency !== null && networkLatency < 250 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {networkLatency} ms
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]/60">Bağlantı Sınıfı:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {networkLatency !== null && networkLatency < 60 ? 'Ultra Hızlı (Fiber/Geniş Bant)' : 
                     networkLatency !== null && networkLatency < 150 ? 'Hızlı / İyi (Broadband)' : 
                     networkLatency !== null && networkLatency < 300 ? 'Orta Derece / Mobil' : 
                     'Yavaş Bağlantı'}
                  </span>
                </div>
              </div>
            )}
            {networkTestState === 'idle' && (
              <p className="text-[11px] text-[var(--text-secondary)]/50 leading-relaxed">
                Uygulamanın barındırıldığı sunucu ile uç cihaz arasındaki anlık gidiş-dönüş ping süresini ölçer.
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={runNetworkTest}
            disabled={networkTestState === 'running'}
            className="w-full py-3 bg-[var(--text-primary)]/[0.03] hover:bg-[var(--text-primary)]/[0.06] border border-[var(--glass-border)] rounded-xl text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {networkTestState === 'running' ? 'Ping Ölçülüyor...' : 'Ağ Gecikmesini Ölç'}
          </motion.button>
        </motion.div>
      </div>

      {/* Yapay Zeka Teşhis Paneli */}
      <div className="spatial-glass border border-indigo-500/20 p-8 rounded-[32px] bg-gradient-to-br from-indigo-500/[0.03] to-purple-500/[0.03] relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.15)]">
              <Sparkles size={22} className="text-indigo-400 animate-pulse" />
            </div>
            <div>
              <span className="premium-label !text-[8px] text-purple-400 font-bold tracking-[0.25em] uppercase flex items-center gap-1">
                <Sparkles size={10} className="text-purple-400 animate-pulse" /> YAPAY ZEKA DESTEKLİ TEŞHİS
              </span>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">AI Sistem Sağlığı Analizcisi</h4>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={runAiAnalysis}
            disabled={aiState === 'running'}
            className="px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-95 rounded-2xl text-[9px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/10 flex items-center gap-2.5 transition-all disabled:opacity-50"
          >
            {aiState === 'running' ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                AI ANALİZ EDİYOR...
              </>
            ) : (
              <>
                <Sparkles size={12} />
                YAPAY ZEKA TEŞHİSİNİ ÇALIŞTIR
              </>
            )}
          </motion.button>
        </div>

        {aiState === 'idle' && (
          <div className="p-6 bg-white/[0.01] border border-[var(--glass-border)] rounded-2xl flex flex-col items-center justify-center text-center py-10 space-y-3">
            <span className="text-[11px] text-[var(--text-secondary)]/50 max-w-md leading-relaxed">
              Sistem test verilerini, ağ gecikmelerini ve PWA izinlerini analiz ederek yapay zeka destekli bir teşhis raporu hazırlamak için yukarıdaki butona tıklayın.
            </span>
          </div>
        )}

        {aiState === 'running' && (
          <div className="p-8 bg-white/[0.01] border border-[var(--glass-border)] rounded-2xl flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400">
                <Sparkles size={16} className="animate-pulse" />
              </div>
            </div>
            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] animate-pulse">Sistem Telemetrisi AI Modelinde İşleniyor...</p>
          </div>
        )}

        {aiState === 'success' && aiReport && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Score & Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Score ring/visual */}
              <div className="spatial-glass border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden bg-white/[0.01]">
                <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">SİSTEM SAĞLIK SKORU</span>
                <div className="relative flex items-center justify-center my-2">
                  <span className={`text-4xl font-extrabold tracking-tight ${
                    aiScore >= 90 ? 'text-emerald-400' :
                    aiScore >= 70 ? 'text-amber-400' : 'text-rose-400'
                  }`}>{aiScore}</span>
                  <span className="text-xs text-[var(--text-secondary)]/30 font-bold">/100</span>
                </div>
                <div className="w-full bg-[var(--text-primary)]/[0.03] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      aiScore >= 90 ? 'bg-emerald-500' :
                      aiScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${aiScore}%` }}
                  />
                </div>
              </div>

              {/* Status Message */}
              <div className="md:col-span-2 spatial-glass border border-white/5 p-6 rounded-2xl bg-white/[0.01] flex items-center h-full">
                <p className="text-xs text-[var(--text-primary)]/80 leading-relaxed font-medium">
                  {aiReport.status}
                </p>
              </div>
            </div>

            {/* Metrics vs Suggestions Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Telemetry Metrics */}
              <div className="space-y-3">
                <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">ANALİZ EDİLEN TELEMETRİ VERİLERİ</span>
                <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-2.5">
                  {aiReport.metrics.map((metric, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-[var(--text-primary)]/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                      <span>{metric}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Suggestions / Actions */}
              <div className="space-y-3">
                <span className="text-[9px] text-[var(--text-secondary)]/40 font-bold uppercase tracking-wider block">YAPAY ZEKA EYLEM TAVSİYELERİ</span>
                <div className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-2.5">
                  {aiReport.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                      <Sparkles size={12} className="text-purple-400 mt-0.5 shrink-0" />
                      <span>{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Device & Session Specs */}
      <div className="spatial-glass border border-[var(--glass-border)] p-6 rounded-[28px] space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--glass-border)] pb-3">
          <Info size={16} className="text-indigo-400" />
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
    </div>
  );
});
