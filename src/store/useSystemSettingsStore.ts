import { create } from 'zustand';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SystemSettings } from '../types';

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
};

export const useSystemSettingsStore = create<SystemSettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: true,
  initialized: false,
  init: () => {
    if (get().initialized) return () => {};
    
    const unsub = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
      if (docSnap.exists()) {
        set({ settings: { ...defaultSettings, ...docSnap.data() as SystemSettings }, loading: false, initialized: true });
      } else {
        set({ loading: false, initialized: true });
      }
    }, (err) => {
      console.error("Sistem ayarları çekilirken hata:", err);
      set({ loading: false, initialized: true });
    });
    
    return unsub;
  },
  updateSettings: async (newSettings) => {
    try {
      const merged = { ...get().settings, ...newSettings };
      await setDoc(doc(db, 'settings', 'system'), merged, { merge: true });
      return true;
    } catch (error) {
      console.error("Ayar güncelleme hatası:", error);
      throw error;
    }
  },
}));
