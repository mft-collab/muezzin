import { useEffect } from 'react';
import { useEzanVakitleri } from './useEzanVakitleri';
import {
  getTurkeyNow,
  parseVakitToDate,
  calculateLastThirdOfNight,
  calculateKerahatTimes,
} from '../lib/dateUtils';
import { Vakit } from '../types';

export function useCircadianTheme() {
  const { bugunVakitler } = useEzanVakitleri();

  useEffect(() => {
    if (!bugunVakitler) return;

    const bugunStr = bugunVakitler.tarih;

    // Parse prayer times once
    const imsakSaati = parseVakitToDate(bugunStr, bugunVakitler.imsak || bugunVakitler.sabah);
    const gunesSaati = parseVakitToDate(bugunStr, bugunVakitler.gunes);
    const ogleSaati = parseVakitToDate(bugunStr, bugunVakitler.ogle);
    const aksamSaati = parseVakitToDate(bugunStr, bugunVakitler.aksam);

    if (!imsakSaati || !gunesSaati || !ogleSaati || !aksamSaati) return;

    const vakitler: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
    const parsedVakitler = vakitler.map(vKey => ({
      key: vKey,
      time: parseVakitToDate(bugunStr, bugunVakitler[vKey])
    }));

    const updateTheme = () => {
      const now = getTurkeyNow();

      // Determine current vakit period
      let mevcutVakit: Vakit | 'gunes' = 'yatsi';

      // Find current vakit period using pre-parsed dates
      let found = false;
      for (let i = parsedVakitler.length - 1; i >= 0; i--) {
        const item = parsedVakitler[i];
        if (item.time && now >= item.time) {
          mevcutVakit = item.key;
          found = true;
          break;
        }
      }
      if (!found) {
        mevcutVakit = 'yatsi';
      }

      // Special case: gunes period is between sunrise and dhuhr
      if (now >= gunesSaati && now < ogleSaati) {
        mevcutVakit = 'gunes';
      }

      // ── 1. Friday/Cuma Check ──
      const isFriday = now.getDay() === 5;
      const isCumaVakti = isFriday && mevcutVakit === 'gunes';

      // ── 2. Teheccüd Check ──
      let isTeheccud = false;
      if (imsakSaati && aksamSaati) {
        const aksamReferansi = now < imsakSaati ? new Date(aksamSaati.getTime() - 24 * 60 * 60 * 1000) : aksamSaati;
        const teheccudBaslangic = calculateLastThirdOfNight(aksamReferansi, imsakSaati);
        isTeheccud = now >= teheccudBaslangic && now < imsakSaati;
      }

      // ── 3. Kerahat Check ──
      let isKerahat = false;
      if (gunesSaati && ogleSaati && aksamSaati) {
        const { sabah, ogle, aksam: kerahatAksam } = calculateKerahatTimes(gunesSaati, ogleSaati, aksamSaati);
        isKerahat =
          (now >= sabah.baslangic && now < sabah.bitis) ||
          (now >= ogle.baslangic && now < ogle.bitis) ||
          (now >= kerahatAksam.baslangic && now < kerahatAksam.bitis);
      }

      // ── 4. Set dynamic variables ──
      let period = 'standard';
      let aura = 'var(--aura-amber)';
      let auraSecondary = 'var(--aura-indigo)';

      if (isKerahat) {
        period = 'kerahat';
        aura = 'var(--aura-ruby)';
        auraSecondary = 'var(--aura-amber)';
      } else if (isCumaVakti) {
        period = 'cuma';
        aura = 'var(--aura-emerald)';
        auraSecondary = 'var(--aura-indigo)';
      } else if (isTeheccud) {
        period = 'teheccud';
        aura = 'var(--aura-indigo)';
        auraSecondary = 'var(--aura-rose)';
      } else if (mevcutVakit === 'aksam' || mevcutVakit === 'yatsi') {
        period = 'aksam_yatsi';
        aura = 'var(--aura-ruby)';
        auraSecondary = 'var(--aura-rose)';
      }

      // Write variables to root element
      const root = document.documentElement;
      root.style.setProperty('--dynamic-aura', aura);
      root.style.setProperty('--dynamic-aura-secondary', auraSecondary);
      root.setAttribute('data-circadian-period', period);
    };

    // Run check every 15 seconds
    const timer = setInterval(updateTheme, 15_000);
    updateTheme();

    return () => clearInterval(timer);
  }, [bugunVakitler]);
}
