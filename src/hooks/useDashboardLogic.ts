import { useMemo, useState, useEffect, useRef } from 'react';
import { parseISO, startOfWeek, format } from 'date-fns';
import { useBugunkuGorevlerim } from './useBugunkuGorevlerim';
import { useEzanVakitleri } from './useEzanVakitleri';
import { useSonrakiVakit } from './useSonrakiVakit';
import { useMevcutVakit } from './useMevcutVakit';
import { useHaftaPlan } from './useHaftaPlan';
import { useMuezzinStore } from '../store/useMuezzinStore';
import { useAuthStore } from '../store/useAuthStore';
import { useAktifIzinler } from './useAktifIzinler';
import { useDuyurular } from './useDuyurular';
import { useVakitBildirimleri } from './useVakitBildirimleri';
import { useThemeStore } from '../store/useThemeStore';
import { useGpsVakitStore } from '../store/useGpsVakitStore';
import { getTurkeyDateString } from '../lib/dateUtils';
import { Vakit } from '../types';

export function useDashboardLogic() {
  const { gorevler, loading: gorevLoading } = useBugunkuGorevlerim();
  const { bugunVakitler, yarinVakitler, loading: vakitLoading } = useEzanVakitleri();
  
  const { gpsEnabled, refreshGpsVakitler } = useGpsVakitStore();

  useEffect(() => {
    if (gpsEnabled) {
      refreshGpsVakitler();
    }
  }, [gpsEnabled, refreshGpsVakitler]);

  const sonraki = useSonrakiVakit(bugunVakitler, yarinVakitler);
  const mevcutVakit = useMevcutVakit(bugunVakitler);
 
  const { theme, toggleTheme } = useThemeStore();

 const bugunStr = bugunVakitler?.tarih || getTurkeyDateString();
 const bugunDate = useMemo(() => parseISO(bugunStr), [bugunStr]);
 
 const planDateStr = sonraki?.ezanSaati ? getTurkeyDateString(sonraki.ezanSaati) : bugunStr;
 const planDate = useMemo(() => parseISO(planDateStr), [planDateStr]);
 const haftaBaslangic = useMemo(() => startOfWeek(planDate, { weekStartsOn: 1 }), [planDate]);
 const haftaId = useMemo(() => `W${format(haftaBaslangic, 'yyyy-MM-dd')}`, [haftaBaslangic]);
 
 const { plan, loading: planLoading } = useHaftaPlan(haftaId);
 const isAdmin = useAuthStore(state => state.isAdmin);

 // Race condition kilidi: useDashboardLogic ve HaftalikCizelge aynı anda
 // haftalikPlanOlustur çağırmasın — yalnızca bir kez tetikle
 const selfHealingFiredRef = useRef(false);

 useEffect(() => {
   if (!planLoading && !plan && isAdmin && haftaId && !selfHealingFiredRef.current) {
     selfHealingFiredRef.current = true;
     console.log(`[Self-Healing] Hafta planı bulunamadı (${haftaId}). Yönetici yetkisiyle otomatik oluşturuluyor...`);
     import('../services/planServisi').then(({ haftalikPlanOlustur }) => {
       haftalikPlanOlustur(haftaId).catch(err => {
         console.error('[Self-Healing] Otomatik plan oluşturma başarısız:', err);
         // Başarısız olursa bir sonraki render döngüsünde tekrar denenebilmesi için kilidi aç
         selfHealingFiredRef.current = false;
       });
     });
   }
   // Plan gelirse kilidi sıfırla (ilerleyen hafta geçişlerinde tekrar çalışabilsin)
   if (plan && selfHealingFiredRef.current) {
     selfHealingFiredRef.current = false;
   }
 }, [plan, planLoading, isAdmin, haftaId]);

 const muezzinMap = useMuezzinStore(state => state.muezzinMap);
 const usersLoading = useMuezzinStore(state => state.loading);
 const { aktifIzinler } = useAktifIzinler();
 const { duyurular } = useDuyurular(1);
 const currentUser = useAuthStore(state => state.user);

 const [viewingDuyuru, setViewingDuyuru] = useState<any>(null);

 const vakitKeyForPlan = (sonraki?.vakit || mevcutVakit || 'sabah') as Vakit;
 const { bildirimler: vakitBildirimleri, loading: vakitBildirimleriLoading } = useVakitBildirimleri(planDateStr, vakitKeyForPlan);

 const isAssignableUid = useMemo(() => (uid: string | undefined) => {
 if (!uid || uid === 'SISTEM' || uid === 'Sistem') return true;
 const person = muezzinMap[uid];
 return !!person && person.aktif === true && person.role === 'muezzin';
 }, [muezzinMap]);
 
 const getMuezzinName = useMemo(() => (uid: string | undefined) => {
 if (!uid) return '';
 if (uid === 'SISTEM' || uid === 'Sistem') return 'Sistem';
 if (!isAssignableUid(uid)) return 'Geçersiz Atama';
 return muezzinMap[uid]?.displayName || 'Bilinmiyor';
 }, [muezzinMap, isAssignableUid]);

 const rawBugunPlan = plan?.gunler?.[planDateStr]?.[vakitKeyForPlan];
 const bugunPlan = useMemo(() => {
 if (!rawBugunPlan) return rawBugunPlan;
 return {
 asil: isAssignableUid(rawBugunPlan.asil) ? rawBugunPlan.asil : 'Sistem',
 yedek: isAssignableUid(rawBugunPlan.yedek) ? rawBugunPlan.yedek : 'Sistem',
 };
 }, [rawBugunPlan, isAssignableUid]);
 const asilIzinde = bugunPlan?.asil ? aktifIzinler.some(izin => izin.uid === bugunPlan.asil) : false;
 const yedekIzinde = bugunPlan?.yedek ? aktifIzinler.some(izin => izin.uid === bugunPlan.yedek) : false;

 const normalizeDurum = (durum: string | undefined) => {
 return durum === 'bekliyor' || durum === 'onaylandi' || durum === 'reddedildi' ? durum : undefined;
 };

 const asilDurum = useMemo(() => normalizeDurum(
 vakitBildirimleri.find(b => b.uid === bugunPlan?.asil && b.tip === 'asil')?.durum
 ), [vakitBildirimleri, bugunPlan?.asil]);

 const yedekDurum = useMemo(() => normalizeDurum(
 vakitBildirimleri.find(b => b.uid === bugunPlan?.yedek && b.tip === 'yedek')?.durum
 ), [vakitBildirimleri, bugunPlan?.yedek]);

 const auraColor = useMemo(() => {
 switch (mevcutVakit) {
 case 'aksam': return 'var(--aura-rose)';
 case 'yatsi': return 'var(--aura-indigo)';
 case 'ogle': 
 case 'ikindi': return 'var(--aura-amber)';
 case 'sabah': return 'var(--aura-emerald)';
 default: return 'var(--aura-indigo)';
 }
 }, [mevcutVakit]);

 const secondaryAuraColor = useMemo(() => {
 switch (mevcutVakit) {
 case 'aksam': return 'var(--aura-indigo)';
 case 'yatsi': return 'var(--aura-emerald)';
 case 'ogle': 
 case 'ikindi': return 'var(--aura-rose)';
 case 'sabah': return 'var(--aura-amber)';
 default: return 'var(--aura-emerald)';
 }
 }, [mevcutVakit]);

 const isHeroLoading = (vakitLoading && !bugunVakitler);
 const isHademelerLoading = (planLoading && !plan) || vakitBildirimleriLoading || (usersLoading && Object.keys(muezzinMap).length === 0);

 // Return memoized state to prevent unnecessary downstream re-renders
 return useMemo(() => ({
 gorevler,
 gorevLoading,
 bugunVakitler,
 sonraki,
 mevcutVakit,
 bugunDate,
 planDateStr,
 bugunPlan,
 asilDurum,
 yedekDurum,
 asilIzinde,
 yedekIzinde,
 isHeroLoading,
 isHademelerLoading,
 auraColor,
 duyurular,
 viewingDuyuru,
 setViewingDuyuru,
 currentUser,
 getMuezzinName,
 theme,
 toggleTheme,
 secondaryAuraColor
 }), [
 gorevler, gorevLoading, bugunVakitler, sonraki, mevcutVakit, 
 bugunDate, planDateStr, bugunPlan, asilDurum, yedekDurum, asilIzinde, yedekIzinde, 
 isHeroLoading, isHademelerLoading, auraColor, duyurular, 
 viewingDuyuru, currentUser, getMuezzinName, theme, toggleTheme, secondaryAuraColor
 ]);
}
