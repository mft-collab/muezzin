import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vakitler, GunlukVakit } from '../types';
import { aylikVakitleriCek } from '../services/ezanVaktiServisi';
import { getTurkeyNow, getTurkeyDateString } from '../lib/dateUtils';

export function useEzanVakitleri() {
  const [bugunVakitler, setBugunVakitler] = useState<GunlukVakit | null>(null);
  const [yarinVakitler, setYarinVakitler] = useState<GunlukVakit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentMonthData: Vakitler | null = null;
    let nextMonthData: Vakitler | null = null;
    let isMounted = true;

    const checkData = () => {
      if (!currentMonthData || !isMounted) return;
      const tarih = getTurkeyNow();
      const yarinDate = new Date(tarih);
      yarinDate.setDate(tarih.getDate() + 1);

      const bugunStr = getTurkeyDateString(tarih);
      const yarinStr = getTurkeyDateString(yarinDate);

      // Bugünün vakitlerini bul
      if (currentMonthData.gunler && currentMonthData.gunler[bugunStr]) {
        setBugunVakitler(currentMonthData.gunler[bugunStr] as GunlukVakit);
      } else {
        setBugunVakitler(null);
      }

      // Yarının vakitlerini bul
      if (currentMonthData.gunler && currentMonthData.gunler[yarinStr]) {
        setYarinVakitler(currentMonthData.gunler[yarinStr] as GunlukVakit);
      } else if (nextMonthData && nextMonthData.gunler && nextMonthData.gunler[yarinStr]) {
        setYarinVakitler(nextMonthData.gunler[yarinStr] as GunlukVakit);
      } else {
        setYarinVakitler(null);
      }
      
      setLoading(false);
    };

    const fetchFallbackData = async (yil: number, ay: number) => {
      try {
        const data = await aylikVakitleriCek(yil, ay);
        if (isMounted) {
          currentMonthData = data as unknown as Vakitler;
          checkData();
        }
      } catch (err) {
        console.error("Fallback API Hatası:", err);
        if (isMounted) setLoading(false);
      }
    };

    const tarih = getTurkeyNow();
    const yil = tarih.getFullYear();
    const ay = tarih.getMonth() + 1;
    const buAyYYYYMM = `${yil}-${String(ay).padStart(2, '0')}`;
    
    // Yarın ay değişiyor mu?
    const yarinDate = new Date(tarih);
    yarinDate.setDate(tarih.getDate() + 1);
    const yarinAyYYYYMM = `${yarinDate.getFullYear()}-${String(yarinDate.getMonth() + 1).padStart(2, '0')}`;
    
    setLoading(true);

    // Şu anki ayın dinleyicisi
    let fetchingFallback = false;
    const unsubscribeBuAy = onSnapshot(doc(db, 'vakitler', buAyYYYYMM), (snap) => {
      if (snap.exists()) {
        currentMonthData = snap.data() as Vakitler;
        checkData();
      } else if (!fetchingFallback) {
        fetchingFallback = true;
        fetchFallbackData(yil, ay);
      }
    }, (error) => {
      console.error("useEzanVakitleri buAy:", error);
      if (!fetchingFallback) {
        fetchingFallback = true;
        fetchFallbackData(yil, ay);
      }
    });

    // Eğer yarın başka bir aysa, onu da dinle
    let unsubscribeYarin: (() => void) | null = null;
    if (buAyYYYYMM !== yarinAyYYYYMM) {
      unsubscribeYarin = onSnapshot(doc(db, 'vakitler', yarinAyYYYYMM), (snap) => {
        if (snap.exists()) {
          nextMonthData = snap.data() as Vakitler;
          checkData();
        }
      }, (error) => {
         console.error("useEzanVakitleri yarin:", error);
      });
    }

    // Gece yarısı güncellemelerini yakalamak için interval
    const interval = setInterval(checkData, 60000); // Her dakika bugünü yeniden değerle

    return () => {
      isMounted = false;
      unsubscribeBuAy();
      if (unsubscribeYarin) unsubscribeYarin();
      clearInterval(interval);
    };
  }, []);

  return { bugunVakitler, yarinVakitler, loading };
}
