import { useMemo, useState } from 'react';
import { GunlukVakit, SonrakiVakit } from '../types';
import { sonrakiVaktiHesapla } from '../services/ezanVaktiServisi';
import { useMinuteTick } from './useTime';

function ayniVakitMi(a: SonrakiVakit | null, b: SonrakiVakit | null): boolean {
 return !!a && !!b && a.vakit === b.vakit && a.ezanSaati.getTime() === b.ezanSaati.getTime();
}

export function useSonrakiVakit(bugunVakitler: GunlukVakit | null, yarinVakitler: GunlukVakit | null) {
 const tick = useMinuteTick();

 const yeniSonraki = useMemo(() => {
 if (!bugunVakitler) return null;
 return sonrakiVaktiHesapla(bugunVakitler, yarinVakitler || undefined);
 }, [bugunVakitler, yarinVakitler, tick]);

 // Aynı vakit/saate denk gelen ardışık hesaplamalarda referansı koru — bkz.
 // useChangeKey ile aynı "render sırasında state senkronu" deseni, ancak
 // burada boolean değil önceki değerin kendisi saklanıyor.
 const [sonraki, setSonraki] = useState(yeniSonraki);

 if (!ayniVakitMi(sonraki, yeniSonraki) && sonraki !== yeniSonraki) {
 setSonraki(yeniSonraki);
 }

 return ayniVakitMi(sonraki, yeniSonraki) ? sonraki : yeniSonraki;
}
