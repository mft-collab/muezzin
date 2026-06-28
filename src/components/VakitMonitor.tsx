import React, { useEffect, useRef } from 'react';
import { useEzanVakitleri } from '../hooks/useEzanVakitleri';
import { useNotificationStore } from '../store/useNotificationStore';
import {
 getTurkeyNow,
 getTurkeyDateString,
 parseVakitToDate,
} from '../lib/dateUtils';
import { Vakit } from '../types';

const VAKIT_DISPLAY_NAMES: Record<Vakit, string> = {
 sabah: 'Sabah',
 ogle: 'Öğle',
 ikindi: 'İkindi',
 aksam: 'Akşam',
 yatsi: 'Yatsı',
};

/**
 * Global time watcher. Triggers one audible/written local alert when a prayer
 * time enters, with a small grace window so interval drift cannot miss it.
 */
export const VakitMonitor: React.FC = () => {
 const { bugunVakitler } = useEzanVakitleri();
 const { showNotification } = useNotificationStore();
 const sonTetiklenenVakit = useRef<string | null>(null);

 useEffect(() => {
    if (!bugunVakitler) return;

    const bugunStr = bugunVakitler.tarih;
    const vakitler: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];

    // Pre-parse dates once
    const parsedVakitler = vakitler.map(vakitKey => ({
      key: vakitKey,
      date: parseVakitToDate(bugunStr, bugunVakitler[vakitKey]),
      triggerId: `${bugunStr}_${vakitKey}`,
      storageKey: `vakit-bildirimi:${bugunStr}_${vakitKey}`
    })).filter(item => item.date !== null) as Array<{
      key: Vakit;
      date: Date;
      triggerId: string;
      storageKey: string;
    }>;

    const checkVakit = () => {
      const now = getTurkeyNow();

      for (const item of parsedVakitler) {
        const elapsedMs = now.getTime() - item.date.getTime();
        const inTriggerWindow = elapsedMs >= 0 && elapsedMs < 90_000;
        const alreadyTriggered =
          sonTetiklenenVakit.current === item.triggerId ||
          window.localStorage.getItem(item.storageKey) === '1';

        if (inTriggerWindow && !alreadyTriggered) {
          const vakitAdi = VAKIT_DISPLAY_NAMES[item.key];

          showNotification(
            `${vakitAdi} Vakti Girdi`,
            `Aziz Allah... ${vakitAdi} vakti ezanı okunuyor.`,
            'info'
          );

          sonTetiklenenVakit.current = item.triggerId;
          window.localStorage.setItem(item.storageKey, '1');
          break;
        }
      }
    };

    const interval = setInterval(checkVakit, 15_000);
    checkVakit();

    return () => clearInterval(interval);
  }, [bugunVakitler, showNotification]);

 return null;
};
