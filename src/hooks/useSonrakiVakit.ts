import { useState, useEffect } from 'react';
import { GunlukVakit, Vakit } from '../types';
import { sonrakiVaktiHesapla } from '../services/ezanVaktiServisi';

export function useSonrakiVakit(bugunVakitler: GunlukVakit | null, yarinVakitler?: GunlukVakit | null) {
  const [sonraki, setSonraki] = useState<{
    vakit: Vakit;
    ezanSaati: Date;
    baslangicZamani: Date;
    okudumAcilisZamani: Date;
    t1KilitZamani: Date;
  } | null>(null);

  useEffect(() => {
    if (!bugunVakitler) {
      setSonraki(null);
      return;
    }

    // Hemen hesapla
    setSonraki(sonrakiVaktiHesapla(bugunVakitler, yarinVakitler || undefined));

    const interval = setInterval(() => {
      setSonraki(sonrakiVaktiHesapla(bugunVakitler, yarinVakitler || undefined));
    }, 60000); // Her dakika

    return () => clearInterval(interval);
  }, [bugunVakitler, yarinVakitler]);

  return sonraki;
}
