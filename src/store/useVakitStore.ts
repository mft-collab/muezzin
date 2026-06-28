import { create } from 'zustand';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vakitler, GunlukVakit } from '../types';
import { aylikVakitleriCek } from '../services/ezanVaktiServisi';
import { getTurkeyNow, getTurkeyDateString } from '../lib/dateUtils';
import { useSystemSettingsStore } from './useSystemSettingsStore';

const isVakitEqual = (a: GunlukVakit | null, b: GunlukVakit | null) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.tarih === b.tarih &&
         a.sabah === b.sabah &&
         a.ogle === b.ogle &&
         a.ikindi === b.ikindi &&
         a.aksam === b.aksam &&
         a.yatsi === b.yatsi;
};

interface VakitState {
 bugunVakitler: GunlukVakit | null;
 yarinVakitler: GunlukVakit | null;
 /** True only on the very first load when no data exists yet */
 loading: boolean;
 initializing: boolean;
 initialized: boolean;
 dateKey: string;
 currentMonthData: Vakitler | null;
 nextMonthData: Vakitler | null;
 init: () => () => void;
 _processData: () => void;
}

export const useVakitStore = create<VakitState>((set, get) => ({
 bugunVakitler: null,
 yarinVakitler: null,
 loading: true,
 initializing: false,
 initialized: false,
 dateKey: getTurkeyDateString(),
 currentMonthData: null,
 nextMonthData: null,

 _processData: () => {
 const { currentMonthData: curr, nextMonthData: next } = get();
 if (!curr) return;

 const tarih = getTurkeyNow();
 const yarinDate = new Date(tarih);
 yarinDate.setDate(tarih.getDate() + 1);

 const bugunStr = getTurkeyDateString(tarih);
 const yarinStr = getTurkeyDateString(yarinDate);

 const bugunV = curr.gunler?.[bugunStr];
 const newBugun: GunlukVakit | null =
 bugunV?.sabah && bugunV?.ogle && bugunV?.ikindi && bugunV?.aksam && bugunV?.yatsi
 ? ({ ...bugunV, tarih: bugunStr } as GunlukVakit)
 : null;

 const yarinSrc = curr.gunler?.[yarinStr]
 ? curr.gunler[yarinStr]
 : next?.gunler?.[yarinStr];

 const newYarin: GunlukVakit | null =
 yarinSrc?.sabah && yarinSrc?.ogle && yarinSrc?.ikindi && yarinSrc?.aksam && yarinSrc?.yatsi
 ? ({ ...yarinSrc, tarih: yarinStr } as GunlukVakit)
 : null;

 const { bugunVakitler: prevBugun, yarinVakitler: prevYarin } = get();

 // Only update state when data actually changes — avoids unnecessary re-renders
 const bugunChanged = !isVakitEqual(prevBugun, newBugun);
 const yarinChanged = !isVakitEqual(prevYarin, newYarin);

 if (bugunChanged || yarinChanged) {
 set({ bugunVakitler: newBugun, yarinVakitler: newYarin, loading: false, initializing: false, initialized: true });
 } else if (!get().initialized) {
 // First load: just clear the spinner, don't disturb existing data
 set({ loading: false, initializing: false, initialized: true });
 }
 // If nothing changed and already initialized, don't call set() at all
 },

 init: () => {
 if (get().initialized || get().initializing) return () => {};
 set({ initializing: true });

 let cleanup: (() => void) | null = null;
 let currentIlceId = '';

 const startVakitSubscription = (settings: { ilceId: string; ilceAdi: string }) => {
 if (cleanup) cleanup();

 const setupSubscriptions = () => {
 const tarih = getTurkeyNow();
 const buAyYYYYMM = `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, '0')}`;
 const buAyDocId = `${settings.ilceId}_${buAyYYYYMM}`;

 const yarinDate = new Date(tarih);
 yarinDate.setDate(tarih.getDate() + 1);
 const yarinAyYYYYMM = `${yarinDate.getFullYear()}-${String(yarinDate.getMonth() + 1).padStart(2, '0')}`;
 const yarinAyDocId = `${settings.ilceId}_${yarinAyYYYYMM}`;

 // Only show spinner if we have no data at all (first boot)
 if (!get().initialized) {
 set({ loading: true });
 }

 const fetchFallback = async (yil: number, ay: number) => {
 try {
 const data = (await aylikVakitleriCek(yil, ay, settings.ilceId, settings.ilceAdi)) as unknown as Vakitler;
 set({ currentMonthData: data });
 get()._processData();
 const docId = `${settings.ilceId}_${yil}-${String(ay).padStart(2, '0')}`;
 setDoc(doc(db, 'vakitler', docId), data).catch((e) =>
 console.warn('Auto-cache failed:', e)
 );
 } catch (err) {
 console.error('VakitStore Fallback API Hatası:', err);
 set({ loading: false, initializing: false, initialized: true });
 }
 };

 const unsubscribeBuAy = onSnapshot(
 doc(db, 'vakitler', buAyDocId),
 (snap) => {
 if (snap.exists()) {
 set({ currentMonthData: snap.data() as Vakitler });
 get()._processData();
 } else {
 fetchFallback(tarih.getFullYear(), tarih.getMonth() + 1);
 }
 },
 (err) => {
 console.error('Vakitler snapshot error:', err);
 set({ loading: false, initializing: false, initialized: true });
 }
 );

 let unsubscribeYarin: (() => void) | null = null;
 if (buAyYYYYMM !== yarinAyYYYYMM) {
 unsubscribeYarin = onSnapshot(
 doc(db, 'vakitler', yarinAyDocId),
 (snap) => {
 if (snap.exists()) {
 set({ nextMonthData: snap.data() as Vakitler });
 get()._processData();
 }
 },
 (err) => console.warn('Yarın vakitleri çekilemedi:', err)
 );
 }

 return () => {
 unsubscribeBuAy();
 unsubscribeYarin?.();
 };
 };

 cleanup = setupSubscriptions();
 };

 // Initial subscription
 const initialSettings = useSystemSettingsStore.getState().settings;
 currentIlceId = initialSettings.ilceId;
 startVakitSubscription(initialSettings);

 // Re-subscribe only when district changes
 const unsubSettings = useSystemSettingsStore.subscribe((state) => {
 if (state.settings.ilceId !== currentIlceId) {
 currentIlceId = state.settings.ilceId;
 startVakitSubscription(state.settings);
 }
 });

 // Periodic check for day transitions (midnight rollover)
 const interval = setInterval(() => {
 const nowStr = getTurkeyDateString();
 if (get().dateKey !== nowStr) {
 set({ dateKey: nowStr });
 startVakitSubscription(useSystemSettingsStore.getState().settings);
 } else {
 get()._processData();
 }
 }, 60_000);

 return () => {
 if (cleanup) cleanup();
 unsubSettings();
 clearInterval(interval);
 };
 },
}));
