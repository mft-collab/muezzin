import { create } from 'zustand';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Muezzin } from '../types';

interface MuezzinState {
  muezzinler: (Muezzin & { id: string })[];
  muezzinMap: Record<string, Muezzin & { id: string }>;
  loading: boolean;
  initialized: boolean;
  init: () => () => void;
}

export const useMuezzinStore = create<MuezzinState>((set, get) => ({
  muezzinler: [],
  muezzinMap: {},
  loading: true,
  initialized: false,

  init: () => {
    if (get().initialized) return () => {};

    const q = query(collection(db, 'muezzins'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const muezzinler = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Muezzin & { id: string })[];
      
      const muezzinMap = muezzinler.reduce((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
      }, {} as Record<string, Muezzin & { id: string }>);

      set({ muezzinler, muezzinMap, loading: false, initialized: true });
    }, (error) => {
      console.error("MuezzinStore Hatası:", error);
      set({ loading: false, initialized: true });
    });

    return unsubscribe;
  },
}));
