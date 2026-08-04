import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  FirestoreError,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Duyuru } from '../hooks/useDuyurular';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { telemetryService } from './telemetryService';

export function duyurularAbone(
  onData: (duyurular: Duyuru[]) => void,
  onError: (error: FirestoreError) => void
): () => void {
  const q = query(collection(db, 'duyurular'), orderBy('tarih', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Duyuru)),
    onError
  );
}

export async function duyuruYayinla(data: { baslik: string; icerik: string; tip: Duyuru['tip'] }): Promise<void> {
  const path = 'duyurular';
  try {
    await addDoc(collection(db, path), { ...data, tarih: Timestamp.now() });
    await telemetryService.logAudit('Duyuru Yayınlama', data.baslik, `Yeni duyuru panoda paylaşıldı. Kategori: ${data.tip.toUpperCase()}`);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function duyuruSil(id: string, title: string): Promise<void> {
  const path = `duyurular/${id}`;
  try {
    await deleteDoc(doc(db, 'duyurular', id));
    await telemetryService.logAudit('Duyuru Silme', title, 'Yayınlanmış olan duyuru panodan kaldırıldı ve kalıcı olarak silindi.');
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, path);
  }
}
