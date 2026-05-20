import { useMemo, useState } from 'react';
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
import { getTurkeyDateString } from '../lib/dateUtils';
import { Vakit } from '../types';

export function useDashboardLogic() {
  const { gorevler, loading: gorevLoading } = useBugunkuGorevlerim();
  const { bugunVakitler, yarinVakitler, loading: vakitLoading } = useEzanVakitleri();
  const sonraki = useSonrakiVakit(bugunVakitler, yarinVakitler);
  const mevcutVakit = useMevcutVakit(bugunVakitler);

  const bugunStr = bugunVakitler?.tarih || getTurkeyDateString();
  const bugunDate = useMemo(() => parseISO(bugunStr), [bugunStr]);
  
  const planDateStr = sonraki?.ezanSaati ? getTurkeyDateString(sonraki.ezanSaati) : bugunStr;
  const planDate = useMemo(() => parseISO(planDateStr), [planDateStr]);
  const haftaBaslangic = useMemo(() => startOfWeek(planDate, { weekStartsOn: 1 }), [planDate]);
  const haftaId = useMemo(() => `W${format(haftaBaslangic, 'yyyy-MM-dd')}`, [haftaBaslangic]);
  
  const { plan, loading: planLoading } = useHaftaPlan(haftaId);
  const muezzinMap = useMuezzinStore(state => state.muezzinMap);
  const usersLoading = useMuezzinStore(state => state.loading);
  const { aktifIzinler } = useAktifIzinler();
  const { duyurular } = useDuyurular(1);
  const currentUser = useAuthStore(state => state.user);

  const [viewingDuyuru, setViewingDuyuru] = useState<any>(null);

  const vakitKeyForPlan = (sonraki?.vakit || mevcutVakit || 'sabah') as Vakit;
  
  const getMuezzinName = useMemo(() => (uid: string | undefined) => {
    if (!uid) return '';
    if (uid === 'SISTEM' || uid === 'Sistem') return 'Sistem';
    return muezzinMap[uid]?.displayName || 'Bilinmiyor';
  }, [muezzinMap]);

  const bugunPlan = plan?.gunler?.[planDateStr]?.[vakitKeyForPlan];
  const asilIzinde = bugunPlan?.asil ? aktifIzinler.some(izin => izin.uid === bugunPlan.asil) : false;
  const yedekIzinde = bugunPlan?.yedek ? aktifIzinler.some(izin => izin.uid === bugunPlan.yedek) : false;

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

  const isHeroLoading = (vakitLoading && !bugunVakitler);
  const isHademelerLoading = (planLoading && !plan) || (usersLoading && Object.keys(muezzinMap).length === 0);

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
    asilIzinde,
    yedekIzinde,
    isHeroLoading,
    isHademelerLoading,
    auraColor,
    duyurular,
    viewingDuyuru,
    setViewingDuyuru,
    currentUser,
    getMuezzinName
  }), [
    gorevler, gorevLoading, bugunVakitler, sonraki, mevcutVakit, 
    bugunDate, planDateStr, bugunPlan, asilIzinde, yedekIzinde, 
    isHeroLoading, isHademelerLoading, auraColor, duyurular, 
    viewingDuyuru, currentUser, getMuezzinName
  ]);
}
