import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Izin } from '../types';
import { getTurkeyDateString } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

// Global Izin Cache
let globalAktifIzinlerCache: Izin[] | null = null;

export function useAktifIzinler() {
 const [aktifIzinler, setAktifIzinler] = useState<Izin[]>(() => globalAktifIzinlerCache || []);
 const [loading, setLoading] = useState(globalAktifIzinlerCache === null);
 // Gün sınırını (gece yarısını) canlı takip etmek için state — bkz.
 // useBugunkuGorevlerim.ts/useVakitStore.ts'teki aynı desen. Önceden `today`
 // yalnızca effect mount anında bir kez hesaplanıyordu; uygulama gece
 // yarısını aşarak açık kalırsa (dashboard/kiosk senaryosu) hem Firestore
 // sorgusu hem client-taraflı filtre eski günde donuyor, bugün başlayan bir
 // izin aktif sayılmıyor, dün biten bir izin hâlâ aktif sayılmaya devam
 // ediyordu (bkz. mimari denetim — üçüncü tur).
 const [today, setToday] = useState(getTurkeyDateString());

 useEffect(() => {
 const interval = setInterval(() => {
 const yeniTarih = getTurkeyDateString();
 if (yeniTarih !== today) {
 setToday(yeniTarih);
 }
 }, 60000);
 return () => clearInterval(interval);
 }, [today]);

 useEffect(() => {
 const path = 'izinler';

 const q = query(
 collection(db, path),
 where('durum', '==', 'onaylandi'),
 where('bitis', '>=', today)
 );

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const activeAndFuture = snapshot.docs.map(doc => ({
 id: doc.id,
 ...doc.data()
 })) as Izin[];

 const active = activeAndFuture.filter(izin => {
 return today >= izin.baslangic;
 });

 globalAktifIzinlerCache = active;
 setAktifIzinler(active);
 setLoading(false);
 }, (err) => {
 handleFirestoreError(err, OperationType.LIST, path);
 setLoading(false);
 });

 return () => unsubscribe();
 }, [today]);

 return { aktifIzinler, loading };
}
