import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bildirim } from '../types';
import { getTurkeyDateString } from '../lib/dateUtils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuthStore } from '../store/useAuthStore';

import { SizeLimitedCache } from '../lib/cache';

// Sayfa geçişlerinde görevlerin 'zıplamasını' engellemek için Global Memory Cache
const globalGorevlerCache = new SizeLimitedCache<string, Bildirim[]>(50);

export function useBugunkuGorevlerim() {
 const uid = useAuthStore(s => s.user?.uid);
 const [currentTarih, setCurrentTarih] = useState(getTurkeyDateString());
 
 const cacheKey = uid ? `${uid}_${currentTarih}` : '';

 const [gorevler, setGorevler] = useState<Bildirim[]>(() => globalGorevlerCache.get(cacheKey) || []);
 const [loading, setLoading] = useState(cacheKey ? !globalGorevlerCache.has(cacheKey) : false);

 useEffect(() => {
 if (!uid || !cacheKey) {
 setGorevler([]);
 setLoading(false);
 return;
 }

 // Sadece cache'de yoksa yükleme animasyonu göster
 if (!globalGorevlerCache.has(cacheKey)) {
 setLoading(true);
 }

 const q = query(
 collection(db, 'bildirimler'),
 where('uid', '==', uid),
 where('tarih', '==', currentTarih)
 );

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Bildirim, 'id'>) } as Bildirim));
 globalGorevlerCache.set(cacheKey, data);
 setGorevler(data);
 setLoading(false);
 }, (error) => {
 handleFirestoreError(error, OperationType.LIST, 'bildirimler');
 setLoading(false);
 });

 return () => unsubscribe();
 }, [uid, currentTarih, cacheKey]);

 useEffect(() => {
 const interval = setInterval(() => {
 const yeniTarih = getTurkeyDateString();
 if (yeniTarih !== currentTarih) {
 setCurrentTarih(yeniTarih);
 }
 }, 60000);
 return () => clearInterval(interval);
 }, [currentTarih]);

 return { gorevler, loading };
}
