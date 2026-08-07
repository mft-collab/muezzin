import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GunlukVakit } from '../types';
import { konumVakitleriniCek } from '../services/gpsVakitServisi';
import { getTurkeyDateString } from '../lib/dateUtils';

interface GpsVakitState {
  gpsEnabled: boolean;
  gpsLoading: boolean;
  gpsCoords: { latitude: number; longitude: number } | null;
  gpsVakitler: GunlukVakit | null;
  gpsKonumAdi: string | null;
  /** GunlukVakit.tarih'ten (sorgulanan konumun KENDİ yerel takvim günü —
   *  bkz. gpsVakitServisi.ts mantık denetimi) KASITLI olarak ayrı tutulur:
   *  bu alan yalnızca "bugün zaten taze veri çektik mi" önbellek kilididir
   *  ve Türkiye'nin takvim gününe göre karşılaştırılır (aşağıdaki
   *  refreshGpsVakitler). Konumun yerel günü Türkiye'den farklıysa (uzak
   *  bir saat diliminden GPS sorgusu), ikisini karıştırmak önbellek
   *  kilidini hiç eşleşmeyip her çağrıda gereksiz API isteği atmasına
   *  yol açardı. */
  lastFetchDate: string | null;
  enableGps: () => Promise<void>;
  disableGps: () => void;
  refreshGpsVakitler: () => Promise<void>;
}

export const useGpsVakitStore = create<GpsVakitState>()(
  persist(
    (set, get) => ({
      gpsEnabled: false,
      gpsLoading: false,
      gpsCoords: null,
      gpsVakitler: null,
      gpsKonumAdi: null,
      lastFetchDate: null,

      enableGps: async () => {
        if (typeof window === 'undefined' || !('geolocation' in navigator)) {
          throw new Error('Cihazınız konum özelliğini desteklemiyor.');
        }

        set({ gpsLoading: true });

        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });

          const { latitude, longitude } = position.coords;
          const result = await konumVakitleriniCek(latitude, longitude);

          set({
            gpsEnabled: true,
            gpsLoading: false,
            gpsCoords: { latitude, longitude },
            gpsVakitler: result.vakitler,
            gpsKonumAdi: result.konumAdi,
            // Türkiye takvim günü — result.date (konumun kendi yerel günü)
            // DEĞİL, bkz. yukarıdaki alan yorumu.
            lastFetchDate: getTurkeyDateString()
          });
        } catch (err) {
          set({ gpsLoading: false });
          throw err;
        }
      },

      disableGps: () => {
        set({
          gpsEnabled: false,
          gpsCoords: null,
          gpsVakitler: null,
          gpsKonumAdi: null,
          lastFetchDate: null
        });
      },

      refreshGpsVakitler: async () => {
        const { gpsEnabled, gpsCoords, lastFetchDate } = get();
        if (!gpsEnabled || !gpsCoords) return;

        const bugunStr = getTurkeyDateString();
        // Skip calling if already updated today to save API requests
        if (lastFetchDate === bugunStr) return;

        set({ gpsLoading: true });
        try {
          const result = await konumVakitleriniCek(gpsCoords.latitude, gpsCoords.longitude);
          set({
            gpsLoading: false,
            gpsVakitler: result.vakitler,
            gpsKonumAdi: result.konumAdi,
            // Türkiye takvim günü — result.date (konumun kendi yerel günü)
            // DEĞİL, bkz. lastFetchDate alan yorumu.
            lastFetchDate: bugunStr
          });
        } catch (err) {
          console.error('GPS vakitleri güncellenemedi:', err);
          set({ gpsLoading: false });
        }
      }
    }),
    {
      name: 'muezzin-gps-vakit-storage'
    }
  )
);
export default useGpsVakitStore;
