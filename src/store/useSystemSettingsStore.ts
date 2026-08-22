import { create } from 'zustand';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SystemSettings } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface SystemSettingsState {
 settings: SystemSettings;
 loading: boolean;
 initialized: boolean;
 init: () => () => void;
 updateSettings: (newSettings: Partial<SystemSettings>) => Promise<boolean>;
}

const defaultSettings: SystemSettings = {
 ilceId: "9148", 
 ilceAdi: "Ceyhan",
 hicriDuzeltme: 0,
};

if (typeof globalThis !== 'undefined') {
  globalThis.__hicriOffset = 0;
}

export const useSystemSettingsStore = create<SystemSettingsState>((set, get) => ({
 settings: defaultSettings,
 loading: true,
 initialized: false,
 init: () => {
 if (get().initialized) return () => {};
 
 const unsub = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
 if (docSnap.exists()) {
    const data = docSnap.data() as SystemSettings;
    if (typeof globalThis !== 'undefined') {
      globalThis.__hicriOffset = data.hicriDuzeltme ?? 0;
    }
    set({ settings: { ...defaultSettings, ...data }, loading: false, initialized: true });
 } else {
 set({ loading: false, initialized: true });
 }
 }, (err) => {
    handleFirestoreError(err, OperationType.GET, 'settings/system');
    set({ loading: false, initialized: true });
 });
 
 return unsub;
 },
 updateSettings: async (newSettings) => {
 try {
 const merged = { ...get().settings, ...newSettings };
    if (typeof globalThis !== 'undefined' && merged.hicriDuzeltme !== undefined) {
      globalThis.__hicriOffset = merged.hicriDuzeltme;
    }
 await setDoc(doc(db, 'settings', 'system'), merged, { merge: true });
 return true;
 } catch (error) {
 // `init()`'teki onSnapshot hatası zaten handleFirestoreError'dan geçip
 // telemetriye gidiyordu — bu catch yalnızca console.error yapıp ham
 // hatayı fırlatıyordu, error_logs'a hiç düşmüyordu (bkz. mimari
 // denetim, aynı dosyada iç tutarsızlık).
 throw handleFirestoreError(error, OperationType.UPDATE, 'settings/system');
 }
 },
}));
