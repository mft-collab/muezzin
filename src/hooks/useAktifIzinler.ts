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

 useEffect(() => {
 const today = getTurkeyDateString();
 const path = 'izinler';

 if (globalAktifIzinlerCache === null) {
 setLoading(true);
 }

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
 }, []);

 return { aktifIzinler, loading };
}
