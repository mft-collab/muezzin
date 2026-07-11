# Müezzin Takip - Ceyhan Ezân Nöbet Yönetim Sistemi

PWA tabanlı, tamamen ücretsiz (Firebase Spark plan) çalışan ezan nöbet yönetim sistemi.

## Kurulum
1. `npm install`
2. `.env` dosyasını `firebase-applet-config.json` ile yapılandırın.
3. `npm run dev` ile çalıştırın.

## Mimari Özet

- **İstemci**: React 19 + Vite + Zustand + Tailwind, Firebase client SDK (Firestore/Auth/Messaging) ile doğrudan konuşur; Cloud Functions kullanılmaz (Spark plan).
- **Otomasyon**: Cloud Functions yerine GitHub Actions cron'ları + `firebase-admin` (bkz. `scripts/`) — haftalık plan üretimi, günlük yatsı-sonu puanlama/arşivleme, aylık ezan takvimi çekme, mazeret devri uzlaştırma, log temizliği.
- **Roller** (`muezzins/{uid}.role`): `admin` (tam yönetim), `muezzin` (nöbet ataması yapılabilir personel), `gozlemci` (salt okuma, atanamaz).
- **Ana koleksiyonler**: `muezzins` (personel), `haftaPlanlari` (haftalık nöbet ızgarası, `bildirimler`'in denormalize önbelleği), `bildirimler` (asıl gerçek kaynak — her gün/vakit/kişi için tek görev kaydı; ID'ler deterministiktir: `{haftaId}_{tarih}_{vakit}_{asil|yedek}`), `vekalet_talepleri` (görev devri teklifleri), `izinler`, `adminUyarilari` (kriz/hata alarmları), `error_logs`/`telemetry_logs`/`audit_logs`.
- **Güvenlik**: Tüm yetkilendirme `firestore.rules`'da uygulanır (istemci kodu güvenilmez kabul edilir). Kritik akışlar (mazeret devri, vekalet kabulü) `getAfter()` ile aynı transaction içindeki çapraz belge doğrulaması kullanır — bkz. `firestore.rules` içindeki `isBackupPromotionFromMazeret` ve `isAcceptedVekaletBildirimTransfer`.

## Test

- `npm run typecheck` — TypeScript tip kontrolü.
- `npm run lint` — ESLint (typescript-eslint + react-hooks kuralları).
- `npm run test:smoke` — saf mantık birim testleri (tie-breaker, plan çekirdeği, tarih hesapları).
- `npm run test:rules` — Firestore güvenlik kuralları, gerçek bir Firestore emülatörüne karşı (`firebase emulators:exec`).
- `npm run test:all` — yukarıdakilerin tümü, CI'da çalışan sıra.
- `npm run test:e2e` — Playwright ile tarayıcı testleri. **Firestore + Auth emülatörlerinin** (`firebase emulators:start --only firestore,auth`) ayrıca çalışıyor olması gerekir; dev server `VITE_USE_EMULATOR=1` ile başlatılır (bkz. `playwright.config.ts`) ve `src/lib/firebase.ts` bu bayrakla production yerine emülatöre bağlanır. `tests/e2e/seed-mazeret.ts` emülatörü seed'ler ve testin gerçek bir Firebase Auth oturumu açması için bir custom token üretir.

## GitHub Secrets Listesi
- `FIREBASE_SERVICE_ACCOUNT_MUEZZIN_C8485`: Firebase Admin için JSON anahtarı.
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`: GitHub Actions için gereken Google servis hesabı anahtarı.
- `VITE_FCM_VAPID_KEY`: Firebase Console → Proje Ayarları → Cloud Messaging → Web push sertifikaları'ndan alınan public key. Build zamanında `deploy.yml` tarafından gömülür; tanımlı değilse push bildirimleri devre dışı kalır (bkz. `src/hooks/useFcmToken.ts`).

## Otomasyon Takvimi
GitHub Actions cron ifadeleri her zaman UTC'dir; Türkiye saati UTC+3'tür (yaz/kış saati uygulanmaz).

- **Haftalık Plan** (`.github/workflows/haftalik-plan.yml`): Pazar 22:30 TR (Cron: `30 19 * * 0`, UTC).
- **Günlük Yatsı Sonu** (`.github/workflows/gunluk-yatsi-sonu.yml`): Her gün 23:30 TR (Cron: `30 20 * * *`, UTC).
- **Mazeret Devirlerini Uzlaştır** (`.github/workflows/mazeret-devirleri.yml`): Her 10 dakikada bir. Mazeret bildirimi sonrası yedek terfisinin haftaPlanlari önbelleğine yansıtılması ve (yedek bulunamazsa) admin alarmı için — bkz. `scripts/mazeretDevirleriniIsle.ts`.
- **Aylık Takvim Güncelleme** (`.github/workflows/aylik-ezan-takvimi.yml`): Her ayın 28'i, 04:00 TR (Cron: `0 1 28 * *`, UTC).
- **Günlük Kayıtlarını Temizle** (`.github/workflows/gunluk-log-temizligi.yml`): Haftada bir, Pazartesi 06:00 TR (Cron: `0 3 * * 1`, UTC). `error_logs`/`telemetry_logs`'daki 30 günden eski kayıtları siler (bkz. `scripts/temizleGunlukler.ts`) — native Firestore TTL policy'nin uygulama seviyesindeki eşdeğeri.

Her cron job'u `workflow_dispatch` ile elle de tetiklenebilir. Kritik 3 job (haftalık plan, günlük yatsı sonu, aylık takvim) başarısız olursa `adminUyarilari` koleksiyonuna otomatik bir uyarı yazılır (bkz. `scripts/lib/reportWorkflowFailure.ts`) ve admin panelinde görünür.

Deploy (`deploy.yml`), `CI Test Suite` iş akışı main'de başarıyla tamamlandıktan SONRA tetiklenir (`workflow_run`) ve hosting ile birlikte `firestore.rules`/`firestore.indexes.json` dosyalarını da production'a uygular.
