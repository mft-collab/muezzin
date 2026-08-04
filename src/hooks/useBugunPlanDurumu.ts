import { useMemo, useRef, useEffect } from 'react';
import { parseISO, startOfWeek, format } from 'date-fns';
import { useHaftaPlan } from './useHaftaPlan';
import { useVakitBildirimleri } from './useVakitBildirimleri';
import { useAktifIzinler } from './useAktifIzinler';
import { useMuezzinStore } from '../store/useMuezzinStore';
import { useAuthStore } from '../store/useAuthStore';
import { Bildirim, Vakit } from '../types';

function bildirimZamani(bildirim: Bildirim) {
  const value = bildirim.sonGuncelleme as unknown as { toMillis?: () => number; seconds?: number } | undefined;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function aktifBildirimSec(bildirimler: Bildirim[], tip: Bildirim['tip']) {
  return bildirimler
    .filter(b => b.tip === tip && b.durum !== 'reddedildi')
    .sort((a, b) => {
      const statusDiff = (a.durum === 'onaylandi' ? 0 : 1) - (b.durum === 'onaylandi' ? 0 : 1);
      if (statusDiff !== 0) return statusDiff;
      return bildirimZamani(b) - bildirimZamani(a);
    })[0];
}

function normalizeDurum(durum: string | undefined) {
  return durum === 'bekliyor' || durum === 'onaylandi' || durum === 'reddedildi' ? durum : undefined;
}

/**
 * Bugünün (planDateStr) plan atamasını, üzerine bindirilmiş canlı vekalet/
 * mazeret bildirimlerini ve buna bağlı izin/durum bilgisini tek yerde toplar
 * — bkz. useDashboardLogic.ts'teki asıl orkestrasyon.
 */
export function useBugunPlanDurumu(planDateStr: string, vakitKeyForPlan: Vakit) {
  const planDate = useMemo(() => parseISO(planDateStr), [planDateStr]);
  const haftaBaslangic = useMemo(() => startOfWeek(planDate, { weekStartsOn: 1 }), [planDate]);
  const haftaId = useMemo(() => `W${format(haftaBaslangic, 'yyyy-MM-dd')}`, [haftaBaslangic]);

  const { plan, loading: planLoading } = useHaftaPlan(haftaId);
  const isAdmin = useAuthStore(state => state.isAdmin);

  // Race condition kilidi: bu hook ve HaftalikCizelge aynı anda
  // haftalikPlanOlustur çağırmasın — yalnızca bir kez tetikle
  const selfHealingFiredRef = useRef(false);

  useEffect(() => {
    if (!planLoading && !plan && isAdmin && haftaId && !selfHealingFiredRef.current) {
      selfHealingFiredRef.current = true;
      if (import.meta.env.DEV) {
        console.log(`[Self-Healing] Hafta planı bulunamadı (${haftaId}). Yönetici yetkisiyle otomatik oluşturuluyor...`);
      }
      import('../services/planServisi').then(({ haftalikPlanOlustur }) => {
        haftalikPlanOlustur(haftaId).catch(err => {
          console.error('[Self-Healing] Otomatik plan oluşturma başarısız:', err);
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
  const liveAsilBildirim = useMemo(() => aktifBildirimSec(vakitBildirimleri, 'asil'), [vakitBildirimleri]);
  const liveYedekBildirim = useMemo(() => aktifBildirimSec(vakitBildirimleri, 'yedek'), [vakitBildirimleri]);
  const bugunPlan = useMemo(() => {
    if (!rawBugunPlan) return rawBugunPlan;
    const asilUid = liveAsilBildirim?.uid || rawBugunPlan.asil;
    const yedekUid = liveYedekBildirim?.uid || rawBugunPlan.yedek;
    return {
      asil: isAssignableUid(asilUid) ? asilUid : 'Sistem',
      yedek: isAssignableUid(yedekUid) ? yedekUid : 'Sistem',
    };
  }, [rawBugunPlan, liveAsilBildirim?.uid, liveYedekBildirim?.uid, isAssignableUid]);

  const asilIzinde = bugunPlan?.asil ? aktifIzinler.some(izin => izin.uid === bugunPlan.asil) : false;
  const yedekIzinde = bugunPlan?.yedek ? aktifIzinler.some(izin => izin.uid === bugunPlan.yedek) : false;

  const asilDurum = useMemo(() => normalizeDurum(
    vakitBildirimleri.find(b => b.uid === bugunPlan?.asil && b.tip === 'asil')?.durum
  ), [vakitBildirimleri, bugunPlan?.asil]);

  const yedekDurum = useMemo(() => normalizeDurum(
    vakitBildirimleri.find(b => b.uid === bugunPlan?.yedek && b.tip === 'yedek')?.durum
  ), [vakitBildirimleri, bugunPlan?.yedek]);

  const isHademelerLoading = (planLoading && !plan) || vakitBildirimleriLoading || (usersLoading && Object.keys(muezzinMap).length === 0);

  return { bugunPlan, asilDurum, yedekDurum, asilIzinde, yedekIzinde, isHademelerLoading, getMuezzinName };
}
