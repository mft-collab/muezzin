import { useMemo, useRef } from 'react';
import { GunlukVakit, SonrakiVakit } from '../types';
import { sonrakiVaktiHesapla } from '../services/ezanVaktiServisi';
import { useMinuteTick } from './useTime';

export function useSonrakiVakit(bugunVakitler: GunlukVakit | null, yarinVakitler: GunlukVakit | null) {
 const tick = useMinuteTick();
 const prevSonrakiRef = useRef<SonrakiVakit | null>(null);

 const sonraki = useMemo(() => {
 if (!bugunVakitler) return null;
 const yeniSonraki = sonrakiVaktiHesapla(bugunVakitler, yarinVakitler || undefined);
 
 // Eğer önceki hesaplamayla aynı vakit ve aynı saate denk geliyorsa referansı koru
 if (prevSonrakiRef.current && yeniSonraki) {
 if (
 prevSonrakiRef.current.vakit === yeniSonraki.vakit &&
 prevSonrakiRef.current.ezanSaati.getTime() === yeniSonraki.ezanSaati.getTime()
 ) {
 return prevSonrakiRef.current;
 }
 }
 
 prevSonrakiRef.current = yeniSonraki;
 return yeniSonraki;
 }, [bugunVakitler, yarinVakitler, tick]);

 return sonraki;
}
