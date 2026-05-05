# Müezzin Takip - Ceyhan Ezân Nöbet Yönetim Sistemi

PWA tabanlı, tamamen ücretsiz (Firebase Spark plan) çalışan ezan nöbet yönetim sistemi.

## Kurulum
1. `npm install`
2. `.env` dosyasını `firebase-applet-config.json` ile yapılandırın.
3. `npm run dev` ile çalıştırın.

## GitHub Secrets Listesi
- `FIREBASE_SERVICE_ACCOUNT_MUEZZIN_C8485`: Firebase Admin için JSON anahtarı.
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`: GitHub Actions için gereken Google servis hesabı anahtarı.

## Otomasyon Takvimi
- **Haftalık Plan**: Pazar günleri, yatsıdan 1 saat sonra (Cron: `30 18 * * 0`).
- **Günlük Yatsı Sonu**: Her gün yatsıdan 1 saat sonra (Cron: `30 18 * * *`).
- **Aylık Takvim Güncelleme**: Her ayın 28'i (Cron: `0 1 28 * *`).
