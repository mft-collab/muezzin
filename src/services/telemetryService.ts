import { db, auth } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export interface TelemetryEvent {
  eventType: 'page_view' | 'click' | 'error' | 'performance';
  eventName: string;
  metadata?: Record<string, any>;
}

class TelemetryService {
  private isEnabled: boolean = true;

  constructor() {
    // Profil veya tarayıcı ayarlarından onay durumunu oku
    const savedConsent = localStorage.getItem('muezzin-telemetry-consent');
    this.isEnabled = savedConsent !== 'false';

    // Global hata ve işlenmemiş promise reddi yakalayıcıları (Crashlytics benzeri otomatik izleme)
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        // Zaten işlenmiş olanları es geçmek için:
        if (event.message && event.message.includes('ResizeObserver')) return; // Gürültülü ve zararsız uyarılardan kaçın
        const error = event.error || new Error(event.message || 'Bilinmeyen Çalışma Zamanı Hatası');
        this.logError(error, `Global Runtime Exception: ${event.filename || 'Bilinmeyen Dosya'}:${event.lineno || 0}:${event.colno || 0}`);
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        // Gürültülü bazı uyarılardan kaçın
        if (reason && reason.message && reason.message.includes('ResizeObserver')) return;
        const error = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason) || 'Unhandled Promise Rejection');
        this.logError(error, 'Global Unhandled Promise Rejection');
      });
    }
  }

  /**
   * Kullanıcının izleme onayını günceller (KVKK / GDPR Uyumu)
   */
  setConsent(consent: boolean) {
    this.isEnabled = consent;
    localStorage.setItem('muezzin-telemetry-consent', consent ? 'true' : 'false');
    
    this.logEvent({
      eventType: 'performance',
      eventName: consent ? 'TELEMETRY_ENABLED' : 'TELEMETRY_DISABLED',
      metadata: { consentState: consent }
    });
  }

  /**
   * Kullanıcı rızasını sorgular
   */
  getConsentState(): boolean {
    return this.isEnabled;
  }

  /**
   * Cihaz ve tarayıcı bilgilerini kişisel veri ihlali yapmadan güvenli derler
   */
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
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Firefox") > -1) return "Firefox";
    if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) return "Opera";
    if (userAgent.indexOf("Chrome") > -1) return "Chrome";
    if (userAgent.indexOf("Safari") > -1) return "Safari";
    return "Diğer/Mobil Tarayıcı";
  }

  /**
   * Sayfa geçişlerini ve kullanıcı tıklamalarını Firestore'a güvenle yazar
   */
  async logEvent(event: TelemetryEvent) {
    if (!this.isEnabled) return;

    try {
      const currentUser = auth.currentUser;
      const payload = {
        eventType: event.eventType,
        eventName: event.eventName,
        userId: currentUser ? currentUser.uid : 'guest', // Kişisel veriyi gizlemek için sadece UID
        metadata: {
          ...event.metadata,
          device: this.getDeviceMetadata(),
        },
        timestamp: Timestamp.now()
      };

      // Firestore'da 'telemetry_logs' koleksiyonuna kaydet
      await addDoc(collection(db, 'telemetry_logs'), payload);
    } catch (err) {
      // Konsola sadece uyarı veriyoruz, uygulamanın çalışmasını asla bölmüyoruz
      console.warn('Telemetry log hatası:', err);
    }
  }

  /**
   * Uygulama içi kritik çalışma hatalarını otomatik olarak raporlar (Crashlytics benzeri)
   */
  async logError(error: Error, componentStack?: string) {
    if (!this.isEnabled) return;

    try {
      const currentUser = auth.currentUser;
      await addDoc(collection(db, 'error_logs'), {
        errorMessage: error.message,
        errorStack: error.stack || '',
        componentStack: componentStack || '',
        userId: currentUser ? currentUser.uid : 'guest',
        device: this.getDeviceMetadata(),
        timestamp: Timestamp.now()
      });
    } catch (err) {
      console.warn('Hata günlüğü yazılamadı:', err);
    }
  }
}

export const telemetryService = new TelemetryService();
