import { db, auth } from '../lib/firebase';
import { collection, addDoc, Timestamp, writeBatch, doc } from 'firebase/firestore';

export interface TelemetryEvent {
  eventType: 'page_view' | 'click' | 'error' | 'performance';
  eventName: string;
  metadata?: Record<string, any>;
}

/** Breadcrumb kırıntısı — kullanıcının son eylemlerinin izi */
export interface Breadcrumb {
  action: string;
  category: 'navigation' | 'user_action' | 'network' | 'system';
  data?: Record<string, any>;
  timestamp: number; // performance.now()
  wallTime: string;  // ISO tarih
}

/** Hata anındaki uygulama durum fotoğrafı */
export interface StateSnapshot {
  authUid: string | null;
  authRole: string | null;
  currentPath: string;
  theme: string | null;
  gpsEnabled: boolean;
  isOnline: boolean;
  swVersion: string | null;
  swState: string | null;
  appVersion: string;
  buildTimestamp: string;
  networkType: string;
  networkRtt: number | null;
  memoryUsedMb: number | null;
}

/** Genişletilmiş hata logu — Firestore'a yazılan tam kayıt */
export interface EnrichedErrorLog {
  errorMessage: string;
  errorStack: string;
  componentStack: string;
  userId: string;
  device: {
    os: string;
    browser: string;
    screenSize: string;
    pwaMode: boolean;
    language: string;
  };
  breadcrumbs: Breadcrumb[];
  stateSnapshot: StateSnapshot;
  timestamp: any;
}

// ─── Breadcrumb Halka Tamponu ─────────────────────────────────────────────────
const MAX_BREADCRUMBS = 25;
const breadcrumbBuffer: Breadcrumb[] = [];

function pushBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp' | 'wallTime'>) {
  breadcrumbBuffer.push({
    ...crumb,
    timestamp: Math.round(performance.now()),
    wallTime: new Date().toISOString(),
  });
  if (breadcrumbBuffer.length > MAX_BREADCRUMBS) {
    breadcrumbBuffer.shift(); // Halka: en eski kırıntıyı at
  }
}

function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbBuffer];
}

// ─── PWA Service Worker Sürümü ───────────────────────────────────────────────
async function getSwInfo(): Promise<{ version: string | null; state: string | null }> {
  try {
    if (!('serviceWorker' in navigator)) return { version: null, state: null };
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return { version: null, state: null };
    const sw = reg.active || reg.installing || reg.waiting;
    const state = reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'unknown';
    // SW scriptURL'den versiyon hash'ini çıkar (örn: /sw.js?v=abc123)
    const scriptUrl = sw?.scriptURL || '';
    const versionMatch = scriptUrl.match(/[?&]v=([^&]+)/);
    const version = versionMatch ? versionMatch[1] : (scriptUrl.split('/').pop() || null);
    return { version, state };
  } catch {
    return { version: null, state: null };
  }
}

// ─── Ağ Durumu ───────────────────────────────────────────────────────────────
function getNetworkInfo(): { type: string; rtt: number | null } {
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!conn) return { type: navigator.onLine ? 'online' : 'offline', rtt: null };
  return {
    type: conn.effectiveType || conn.type || (navigator.onLine ? 'online' : 'offline'),
    rtt: typeof conn.rtt === 'number' ? conn.rtt : null,
  };
}

// ─── Bellek Kullanımı ─────────────────────────────────────────────────────────
function getMemoryMb(): number | null {
  try {
    const mem = (performance as any).memory;
    if (!mem) return null;
    return Math.round(mem.usedJSHeapSize / 1024 / 1024);
  } catch {
    return null;
  }
}

// ─── Durum Fotoğrafı ─────────────────────────────────────────────────────────
async function captureStateSnapshot(): Promise<StateSnapshot> {
  const user = auth.currentUser;
  const swInfo = await getSwInfo();
  const net = getNetworkInfo();

  // Döngüsel bağımlılıkları (circular dependency) önlemek için store'lara gitmek yerine
  // doğrudan tarayıcının yerel hafızasından senkron ve hızlı okuma yapıyoruz.
  let theme: string | null = null;
  let gpsEnabled = false;
  
  try {
    const themeStoreRaw = localStorage.getItem('muezzin-theme');
    if (themeStoreRaw) {
      theme = JSON.parse(themeStoreRaw).state?.theme || null;
    }
  } catch { /* yoksay */ }
  
  try {
    const gpsStoreRaw = localStorage.getItem('muezzin-gps-vakit');
    if (gpsStoreRaw) {
      gpsEnabled = JSON.parse(gpsStoreRaw).state?.gpsEnabled || false;
    }
  } catch { /* yoksay */ }

  // Firestore kurallarımıza uygun role bilgisini çek
  let authRole: string | null = null;
  try {
    if (user) {
      const tokenResult = await user.getIdTokenResult(false);
      authRole = (tokenResult.claims['role'] as string) || null;
    }
  } catch { /* yoksay */ }

  return {
    authUid: user ? user.uid : null,
    authRole,
    currentPath: typeof window !== 'undefined' ? window.location.pathname : '/',
    theme,
    gpsEnabled,
    isOnline: navigator.onLine,
    swVersion: swInfo.version,
    swState: swInfo.state,
    appVersion: '2.0.0',
    buildTimestamp: new Date().toISOString(),
    networkType: net.type,
    networkRtt: net.rtt,
    memoryUsedMb: getMemoryMb(),
  };
}

// ─── TelemetryService Sınıfı ─────────────────────────────────────────────────
class TelemetryService {
  private isEnabled: boolean = true;
  private eventQueue: any[] = [];
  private flushTimeout: any = null;
  private readonly BATCH_SIZE = 5;
  private readonly FLUSH_INTERVAL_MS = 10000; // 10 saniye

  constructor() {
    const savedConsent = localStorage.getItem('muezzin-telemetry-consent');
    this.isEnabled = savedConsent !== 'false';

    if (typeof window !== 'undefined') {
      // Bir önceki oturumdan kalan yedeği kurtar ve gönder
      this.restoreBackupQueue();

      window.addEventListener('beforeunload', () => {
        this.backupQueueToLocalStorage();
      });
      window.addEventListener('pagehide', () => {
        this.backupQueueToLocalStorage();
      });

      // PWA: Sayfa arka plana geçtiğinde olayları hemen gönder
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushEvents();
        }
      });

      // Global runtime hata yakalayıcısı
      window.addEventListener('error', (event) => {
        if (event.message?.includes('ResizeObserver')) return;
        const error = event.error || new Error(event.message || 'Bilinmeyen Çalışma Zamanı Hatası');
        pushBreadcrumb({
          action: `Runtime Exception: ${event.message?.slice(0, 80)}`,
          category: 'system',
          data: { file: event.filename, line: event.lineno, col: event.colno },
        });
        this.logError(error, `Global Runtime Exception: ${event.filename || 'Bilinmeyen Dosya'}:${event.lineno || 0}:${event.colno || 0}`);
      });

      // İşlenmemiş promise reddi yakalayıcısı
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        if (reason?.message?.includes('ResizeObserver')) return;
        const error = reason instanceof Error
          ? reason
          : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason) || 'Unhandled Promise Rejection');
        pushBreadcrumb({
          action: `Unhandled Rejection: ${error.message.slice(0, 80)}`,
          category: 'system',
        });
        this.logError(error, 'Global Unhandled Promise Rejection');
      });

      // Çevrimiçi/çevrimdışı durum değişikliklerini breadcrumb olarak kaydet
      window.addEventListener('online', () => {
        pushBreadcrumb({ action: 'Ağ Bağlantısı Sağlandı', category: 'network' });
      });
      window.addEventListener('offline', () => {
        pushBreadcrumb({ action: 'Ağ Bağlantısı Kesildi', category: 'network' });
      });
    }
  }

  private backupQueueToLocalStorage() {
    if (!this.isEnabled || this.eventQueue.length === 0) return;
    try {
      localStorage.setItem('muezzin-telemetry-backup', JSON.stringify(this.eventQueue));
      this.eventQueue = []; // Mükerrer yazmaları önlemek için kuyruğu boşalt
    } catch (err) {
      console.warn('Telemetry kuyruk yedeği başarısız oldu:', err);
    }
  }

  private restoreBackupQueue() {
    if (!this.isEnabled) return;
    try {
      const saved = localStorage.getItem('muezzin-telemetry-backup');
      if (saved) {
        localStorage.removeItem('muezzin-telemetry-backup');
        const restored = JSON.parse(saved);
        if (Array.isArray(restored) && restored.length > 0) {
          const restoredEvents = restored.map((evt: any) => {
            let timestampVal = Timestamp.now();
            if (evt.timestamp) {
              if (typeof evt.timestamp.seconds === 'number' && typeof evt.timestamp.nanoseconds === 'number') {
                timestampVal = new Timestamp(evt.timestamp.seconds, evt.timestamp.nanoseconds);
              }
            }
            return {
              ...evt,
              timestamp: timestampVal,
            };
          });
          this.eventQueue = [...restoredEvents, ...this.eventQueue];
          this.flushEvents();
        }
      }
    } catch (err) {
      console.warn('Telemetry kuyruk kurtarma başarısız oldu:', err);
    }
  }


  /** Kullanıcı rızasını günceller (KVKK / GDPR) */
  setConsent(consent: boolean) {
    this.isEnabled = consent;
    localStorage.setItem('muezzin-telemetry-consent', consent ? 'true' : 'false');
    this.logEvent({
      eventType: 'performance',
      eventName: consent ? 'TELEMETRY_ENABLED' : 'TELEMETRY_DISABLED',
      metadata: { consentState: consent },
    });
  }

  getConsentState(): boolean {
    return this.isEnabled;
  }

  /**
   * Bir breadcrumb kırıntısı ekle (dışarıdan çağrılabilir)
   */
  addBreadcrumb(action: string, category: Breadcrumb['category'], data?: Record<string, any>) {
    pushBreadcrumb({ action, category, data });
  }

  private getDeviceMetadata() {
    return {
      os: (navigator as any).userAgentData?.platform || navigator.platform || 'Bilinmeyen OS',
      browser: this.getBrowserName(),
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      pwaMode: window.matchMedia('(display-mode: standalone)').matches,
      language: navigator.language,
    };
  }

  private getBrowserName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Diğer/Mobil Tarayıcı';
  }

  private async flushEvents() {
    if (this.eventQueue.length === 0) return;

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const batch = writeBatch(db);
      eventsToFlush.forEach(evt => {
        const docRef = doc(collection(db, 'telemetry_logs'));
        batch.set(docRef, evt);
      });
      await batch.commit();
    } catch (err) {
      console.warn('Telemetry toplu log hatası:', err);
      // Hata durumunda olayları geri alıp kaybolmasını önleyelim
      this.eventQueue = [...eventsToFlush, ...this.eventQueue].slice(0, 50);
    }
  }

  /** Sayfa geçişlerini ve tıklamaları kuyruğa ekler ve toplu yazar */
  logEvent(event: TelemetryEvent) {
    if (!this.isEnabled) return;

    const currentUser = auth.currentUser;
    const eventData = {
      eventType: event.eventType,
      eventName: event.eventName,
      userId: currentUser ? currentUser.uid : 'guest',
      metadata: {
        ...event.metadata,
        device: this.getDeviceMetadata(),
      },
      timestamp: Timestamp.now(),
    };

    this.eventQueue.push(eventData);

    if (this.eventQueue.length >= this.BATCH_SIZE) {
      this.flushEvents();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flushEvents(), this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Zenginleştirilmiş hata kaydı:
   * Stack trace + Breadcrumb izleri + Store durum fotoğrafı + PWA/SW sürümü + Ağ durumu
   */
  async logError(error: Error, componentStack?: string) {
    if (!this.isEnabled) return;
    try {
      const [stateSnapshot] = await Promise.all([captureStateSnapshot()]);
      const crumbs = getBreadcrumbs();

      const payload: Omit<EnrichedErrorLog, 'timestamp'> & { timestamp: any } = {
        errorMessage: error.message,
        errorStack: error.stack || '',
        componentStack: componentStack || '',
        userId: auth.currentUser ? auth.currentUser.uid : 'guest',
        device: this.getDeviceMetadata(),
        breadcrumbs: crumbs,
        stateSnapshot,
        timestamp: Timestamp.now(),
      };

      await addDoc(collection(db, 'error_logs'), payload);
    } catch (err) {
      console.warn('Hata günlüğü yazılamadı:', err);
    }
  }

  /** Yönetici işlem denetim izi */
  async logAudit(actionType: string, targetName: string, details: string) {
    try {
      const currentUser = auth.currentUser;
      pushBreadcrumb({
        action: `Admin: ${actionType} — ${targetName}`,
        category: 'user_action',
        data: { details },
      });
      await addDoc(collection(db, 'audit_logs'), {
        actionType,
        targetName,
        details,
        userId: currentUser ? currentUser.uid : 'system',
        userDisplayName: currentUser
          ? (currentUser.displayName || currentUser.email || 'Bilinmeyen Admin')
          : 'Sistem',
        timestamp: Timestamp.now(),
      });
    } catch (err) {
      console.warn('Audit log write error:', err);
    }
  }
}

export const telemetryService = new TelemetryService();
