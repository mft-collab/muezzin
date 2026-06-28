import { useMemo } from 'react';
import { GunlukVakit } from '../types';
import { mevcutVaktiHesapla } from '../services/ezanVaktiServisi';
import { useMinuteTick } from './useTime';

export function useMevcutVakit(bugunVakitler: GunlukVakit | null) {
 const tick = useMinuteTick();

 const mevcut = useMemo(() => {
 if (!bugunVakitler) return null;
 return mevcutVaktiHesapla(bugunVakitler);
 }, [bugunVakitler, tick]);

 return mevcut;
}
