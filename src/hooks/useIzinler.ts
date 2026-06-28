import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Izin } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useIzinler() {
 const [izinler, setIzinler] = useState<Izin[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 if (!auth.currentUser) {
 setIzinler([]);
 setLoading(false);
 return;
 }

 const path = 'izinler';
 const q = query(
 collection(db, path),
 where('uid', '==', auth.currentUser.uid)
 );

 const unsubscribe = onSnapshot(q, (snapshot) => {
 const data = snapshot.docs.map(doc => ({
 id: doc.id,
 ...doc.data()
 })) as Izin[];
 
 data.sort((a, b) => {
 const timeA = a.olusturmaTarihi?.toMillis() || Date.now();
 const timeB = b.olusturmaTarihi?.toMillis() || Date.now();
 return timeB - timeA;
 });
 
 setIzinler(data);
 setLoading(false);
 }, (err) => {
 handleFirestoreError(err, OperationType.LIST, path);
 setError("İzinler yüklenirken bir hata oluştu.");
 setLoading(false);
 });

 return () => unsubscribe();
 }, []);

 const izinTalepEt = async (izin: Omit<Izin, 'id' | 'uid' | 'durum' | 'olusturmaTarihi'>) => {
 if (!auth.currentUser) return;
 const path = 'izinler';
 try {
 await addDoc(collection(db, path), {
 ...izin,
 uid: auth.currentUser.uid,
 durum: 'onay_bekliyor',
 olusturmaTarihi: serverTimestamp()
 });
 } catch (err) {
 throw handleFirestoreError(err, OperationType.CREATE, path);
 }
 };

 const izinSil = async (id: string) => {
 const path = `izinler/${id}`;
 try {
 await deleteDoc(doc(db, 'izinler', id));
 } catch (err) {
 throw handleFirestoreError(err, OperationType.DELETE, path);
 }
 };

 return { izinler, loading, error, izinTalepEt, izinSil };
}
