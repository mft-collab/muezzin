import React, { useEffect, useRef } from 'react';
import { useVakitStore } from '../store/useVakitStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { getTurkeyNow, getTurkeyDateString } from '../lib/dateUtils';
import { Vakit } from '../types';

/**
 * VakitMonitor — Global Time Watcher
 * Ezan vakti geldiğinde otomatik olarak sesli ve yazılı bildirim tetikler.
 */
export const VakitMonitor: React.FC = () => {
  const { bugunVakitler } = useVakitStore();
  const { showNotification } = useNotificationStore();
  const sonTetiklenenVakit = useRef<string | null>(null);

  useEffect(() => {
    if (!bugunVakitler) return;

    const checkVakit = () => {
      const now = getTurkeyNow();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const nowTimeStr = `${h}:${m}`;
      const bugunStr = getTurkeyDateString(now);

      const vakitler: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
      
      for (const vakitKey of vakitler) {
        const vakitSaati = bugunVakitler[vakitKey];
        const triggerId = `${bugunStr}_${vakitKey}`;

        // Eğer şu anki saat vakit saatine eşitse ve henüz bu vakit için bildirim verilmemişse
        if (nowTimeStr === vakitSaati && sonTetiklenenVakit.current !== triggerId) {
          const vakitAdi = vakitKey.charAt(0).toUpperCase() + vakitKey.slice(1);
          
          showNotification(
            `${vakitAdi} Vakti Girdi`,
            `Aziz Allah... ${vakitAdi} vakti ezanı okunuyor.`,
            'info'
          );
          
          sonTetiklenenVakit.current = triggerId;
          break;
        }
      }
    };

    // Her 30 saniyede bir kontrol et (vakit kaçırmamak için yeterli hassasiyet)
    const interval = setInterval(checkVakit, 30000);
    checkVakit(); // İlk renderda da kontrol et

    return () => clearInterval(interval);
  }, [bugunVakitler, showNotification]);

  return null;
};
