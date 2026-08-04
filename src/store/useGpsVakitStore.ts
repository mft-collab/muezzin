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
            lastFetchDate: result.date
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
            lastFetchDate: result.date
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
