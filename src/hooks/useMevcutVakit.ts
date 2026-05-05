import { useState, useEffect } from 'react';
import { GunlukVakit, Vakit } from '../types';
import { mevcutVaktiHesapla } from '../services/ezanVaktiServisi';

export function useMevcutVakit(bugunVakitler: GunlukVakit | null) {
  const [mevcut, setMevcut] = useState<Vakit | null>(null);

  useEffect(() => {
    if (!bugunVakitler) {
      setMevcut(null);
      return;
    }

    setMevcut(mevcutVaktiHesapla(bugunVakitler));

    const interval = setInterval(() => {
      setMevcut(mevcutVaktiHesapla(bugunVakitler));
    }, 60000);

    return () => clearInterval(interval);
  }, [bugunVakitler]);

  return mevcut;
}
