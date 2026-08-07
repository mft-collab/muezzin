import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Download } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { format, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { getTurkeyNow } from '../../../lib/dateUtils';
import { exportCsv } from '../../../lib/csvExport';
import { telemetryService } from '../../../services/telemetryService';

const PERIOD_OPTIONS = [
  { days: 7, label: '7 Gün' },
  { days: 30, label: '30 Gün' },
  { days: 90, label: '90 Gün' },
] as const;

interface PersonnelStat {
  uid: string;
  displayName: string;
  completed: number;
  rejected: number;
  total: number;
  rate: number;
}

export default function SistemAnalitigi() {
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(7);
  const [healthScore, setHealthScore] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; value: number; completed: number; total: number }[]>([]);
  const [personnelStats, setPersonnelStats] = useState<PersonnelStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const muezzinMap = useMuezzinStore(s => s.muezzinMap);

  // Seçili dönem değiştiğinde yükleme durumunu render sırasında ayarla —
  // bkz. useBugunkuGorevlerim.ts'teki aynı desen.
  const [lastPeriodDays, setLastPeriodDays] = useState(periodDays);
  if (periodDays !== lastPeriodDays) {
    setLastPeriodDays(periodDays);
    setLoading(true);
  }

  useEffect(() => {
    // new Date() cihazın kendi saat dilimini kullanır — bildirimler'in
    // `tarih` alanı her zaman Türkiye takvim gününe göre yazıldığından
    // (bkz. dateUtils.ts getTurkeyNow), admin Türkiye dışı bir saat
    // diliminden bakıyorsa istatistik aralığı bir gün kayabiliyordu
    // (bkz. mantık denetimi).
    const today = getTurkeyNow();
    const days: { dateStr: string; dayName: string }[] = [];

    for (let i = periodDays - 1; i >= 0; i--) {
      const d = subDays(today, i);
      days.push({
        dateStr: format(d, 'yyyy-MM-dd'),
        dayName: format(d, 'EEEE', { locale: tr }),
      });
    }

    const startDate = days[0].dateStr;
    const endDate = days[days.length - 1].dateStr;

    const q = query(
      collection(db, 'bildirimler'),
      where('tarih', '>=', startDate),
      where('tarih', '<=', endDate)
    );

    // Gerçek zamanlı dinleyici: getDocs yerine onSnapshot kullanılıyor
    const unsubscribe = onSnapshot(q, (snap) => {
      const allBildirimler = snap.docs.map(doc => doc.data());
      const stats: { day: string; value: number; completed: number; total: number }[] = [];
      let totalScore = 0;
      let validDays = 0;

      for (const { dateStr, dayName } of days) {
        const dayBildirimler = allBildirimler.filter(b => b.tarih === dateStr);

        // Yalnızca asil görevleri sayıyoruz; bunlar hizmet tamamlanma ölçütü.
        const asilGorevler = dayBildirimler.filter(b => b.tip === 'asil');
        const tamamlananlar = asilGorevler.filter(
          b => b.durum === 'onaylandi' || b.durum === 'okundu_varsayilan' || b.durum === 'sistem_atadi'
        );
        const reddedilenler = asilGorevler.filter(b => b.durum === 'reddedildi');

        let dayScore: number;
        if (asilGorevler.length === 0) {
          // O gün için plan yoksa —skoru geçersiz say, ortalamanın dışında tut
          dayScore = -1;
        } else {
          const completionRate = (tamamlananlar.length / asilGorevler.length) * 100;
          // Reddedilen her görev 3 puan düşürür, minimum 0
          dayScore = Math.max(0, Math.round(completionRate - (reddedilenler.length * 3)));
        }

        stats.push({
          day: dayName,
          value: dayScore >= 0 ? dayScore : 0,
          completed: tamamlananlar.length,
          total: asilGorevler.length,
        });

        if (dayScore >= 0) {
          totalScore += dayScore;
          validDays++;
        }
      }

      setWeeklyData(stats);
      const finalScore = validDays > 0 ? Number((totalScore / validDays).toFixed(1)) : 0;
      setTimeout(() => setHealthScore(finalScore), 400);

      // Kişi bazlı performans özeti (dönem genelinde, uid'e göre gruplu)
      const asilGorevlerTumDonem = allBildirimler.filter(b => b.tip === 'asil' && typeof b.uid === 'string');
      const byUid = new Map<string, { completed: number; rejected: number; total: number }>();
      for (const b of asilGorevlerTumDonem) {
        const entry = byUid.get(b.uid) || { completed: 0, rejected: 0, total: 0 };
        entry.total += 1;
        if (b.durum === 'onaylandi' || b.durum === 'okundu_varsayilan' || b.durum === 'sistem_atadi') entry.completed += 1;
        if (b.durum === 'reddedildi') entry.rejected += 1;
        byUid.set(b.uid, entry);
      }
      const personnelList: PersonnelStat[] = Array.from(byUid.entries()).map(([uid, s]) => ({
        uid,
        displayName: muezzinMap[uid]?.displayName || 'Bilinmiyor',
        completed: s.completed,
        rejected: s.rejected,
        total: s.total,
        rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      })).sort((a, b) => b.total - a.total);
      setPersonnelStats(personnelList);

      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, [periodDays, muezzinMap]);

  const periodLabel = useMemo(() => PERIOD_OPTIONS.find(p => p.days === periodDays)?.label || `${periodDays} Gün`, [periodDays]);

  const handleExport = () => {
    const headers = ['Personel', 'Tamamlanan', 'Reddedilen', 'Toplam Görev', 'Tamamlanma Oranı (%)'];
    const rows = personnelStats.map(p => [p.displayName, p.completed, p.rejected, p.total, p.rate]);
    exportCsv(headers, rows, `hizmet-verimliligi-son-${periodDays}-gun.csv`);
    telemetryService.logAudit('Verimlilik Raporu Dışa Aktarma', periodLabel, `Son ${periodDays} günlük kişi bazlı verimlilik raporu CSV olarak dışa aktarıldı.`);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 400, damping: 30 }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="flex flex-col items-center gap-8">
          <div className="w-14 h-14 border-4 border-[var(--dynamic-aura,var(--aura-indigo))]/10 border-t-[var(--dynamic-aura,var(--aura-indigo))] rounded-full animate-spin shadow-[var(--spatial-shadow)]" />
          <p className="authority-title !text-2xs opacity-20 tracking-wide uppercase">VERİLER YÜKLENİYOR</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-12"
    >
      {/* HEADER: High Authority Context */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
            <span className="authority-title !text-2xs !text-emerald-400 font-bold tracking-wide uppercase">DİZGE SAĞLIK PARAMETRELERİ • CANLI</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-light text-[var(--text-primary)] tracking-tight leading-none">
            Hizmet <span className="text-[var(--dynamic-aura,var(--aura-indigo))] italic">Verimliliği</span>
          </h2>
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center gap-1.5 bg-[var(--surface-low)] p-1 rounded-[18px] border border-[var(--glass-border)]">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setPeriodDays(opt.days)}
              className={`px-5 py-2.5 rounded-[14px] text-2xs font-bold uppercase tracking-wide transition-all ${
                periodDays === opt.days
                  ? 'bg-[var(--surface-medium)] text-[var(--text-primary)] shadow-lg'
                  : 'text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)]/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* CHART: Weekly Luminous Pillars — sadece 7 günlük görünümde günlük kırılım anlamlı */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-12 spatial-glass !rounded-card p-6 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[420px] relative overflow-hidden group shadow-[var(--spatial-shadow)] border border-[var(--text-primary)]/5"
        >
          {/* Living Glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--dynamic-aura,var(--aura-indigo))]/20 to-transparent" />

          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="authority-title mb-8 flex items-center gap-3 !text-2xs opacity-40 font-bold tracking-wide">
                <Activity size={14} className="text-[var(--dynamic-aura,var(--aura-indigo))]" />
                SON {periodDays} GÜN — GÖREV TAMAMLANMA ORANI
              </p>
              {/* healthScore rakamı sabit text-9xl idi — dar telefon genişliklerinde
                  (örn. 320-375px) yanındaki %/STATÜ etiketiyle aynı satırda sarmadan
                  çakışıyordu (bkz. görsel tasarım denetimi: KPI kart çakışması).
                  ExecutiveHeroScreen'deki eşdeğer büyük-rakam paterniyle (text-6xl lg:text-8xl)
                  aynı mantıkla duyarlı hale getirildi ve flex-wrap güvenlik ağı eklendi. */}
              <div className="flex items-baseline gap-4 sm:gap-6 flex-wrap">
                <h3 className="text-6xl sm:text-7xl lg:text-9xl font-light tracking-tighter text-[var(--text-primary)] leading-none">
                  {healthScore}
                </h3>
                <div className="flex flex-col">
                  <span className="text-xl sm:text-2xl lg:text-3xl text-[var(--dynamic-aura,var(--aura-indigo))]/40 font-light italic leading-none">%</span>
                  <span className={`authority-title !text-2xs mt-2 font-bold tracking-wide uppercase ${
                    healthScore >= 80 ? 'text-emerald-500' :
                    healthScore >= 60 ? 'text-amber-500' :
                    healthScore > 0 ? 'text-rose-500' : 'text-[var(--text-secondary)]/30'
                  }`}>
                    {healthScore >= 80 ? 'STABİL' : healthScore >= 60 ? 'İZLEME' : healthScore > 0 ? 'KRİTİK' : 'VERİ YOK'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Core — yalnızca 7 günlük dönemde günlük çubuklar gösterilir */}
          {periodDays === 7 && (
            <div className="flex-1 flex items-end justify-between gap-4 sm:gap-10 relative px-6 mb-10 mt-12">
              {/* Background Grid Lines (Subtle) */}
              <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none opacity-[0.06]">
                <div className="border-t border-[var(--text-primary)] w-full" />
                <div className="border-t border-[var(--text-primary)] w-full opacity-50" />
                <div className="border-t border-[var(--text-primary)] w-full" />
              </div>

              {weeklyData.map((data, idx) => (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-10 z-10 group/col relative"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <div className="w-full h-64 flex items-end justify-center">
                    <AnimatePresence>
                      {hoveredIdx === idx && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute -top-16 bg-[var(--surface-medium)] text-[var(--text-primary)] border border-[var(--glass-border)] text-2xs font-bold py-3 px-6 rounded-2xl tracking-wide shadow-[var(--spatial-shadow)] z-50 whitespace-nowrap"
                        >
                          {data.day.toUpperCase()} •{' '}
                          {data.total > 0
                            ? `${data.completed}/${data.total} görev — %${data.value}`
                            : 'Plan yok'}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {data.total > 0 ? (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(data.value, 4)}%` }}
                        transition={{ duration: 1.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className={`w-full max-w-[56px] rounded-[22px] relative overflow-hidden transition-all duration-700 shadow-[var(--spatial-shadow)] ${
                          hoveredIdx === idx ? 'scale-x-110 ' : 'opacity-60 group-hover/col:opacity-100'
                        }`}
                      >
                        {/* Glass Pillar Core */}
                        <div className={`absolute inset-0 transition-colors duration-1000 ${
                          data.value >= 80 ? 'bg-gradient-to-t from-[var(--dynamic-aura,var(--aura-indigo))]/50 via-[var(--dynamic-aura,var(--aura-indigo))]/10 to-transparent' :
                          data.value >= 60 ? 'bg-gradient-to-t from-amber-500/50 via-amber-500/10 to-transparent' :
                          'bg-gradient-to-t from-rose-500/50 via-rose-500/10 to-transparent'
                        }`} />

                        {/* Top Glow Indicator */}
                        <div className={`absolute top-0 inset-x-0 h-[4px] shadow-[0_0_15px_currentColor] transition-all duration-700 ${
                          data.value >= 80 ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-[var(--dynamic-aura,var(--aura-indigo))]' :
                          data.value >= 60 ? 'bg-amber-400 text-amber-400' :
                          'bg-rose-400 text-rose-400'
                        }`} />

                        {/* Aura Animation (Hover) */}
                        {hoveredIdx === idx && (
                          <motion.div
                            layoutId="aura"
                            className="absolute inset-0 bg-[var(--text-primary)]/5 pointer-events-none"
                          />
                        )}
                      </motion.div>
                    ) : (
                      // Plan olmayan günler için minimal gösterge
                      <div className="w-full max-w-[56px] h-[4px] rounded-full bg-[var(--text-primary)]/5" />
                    )}
                  </div>
                  <span className={`authority-title !text-2xs transition-all duration-700 font-bold tracking-wide ${
                    hoveredIdx === idx ? 'text-[var(--dynamic-aura,var(--aura-indigo))] opacity-100' : 'opacity-20'
                  }`}>
                    {data.day.substring(0, 3).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Uzun dönemlerde günlük kırılım anlamlı olmadığından bilgilendirici yer tutucu gösterilir */}
          {periodDays !== 7 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 mb-10 mt-12 text-center">
              <div className="w-14 h-14 rounded-[24px] bg-[var(--text-primary)]/[0.03] border border-[var(--text-primary)]/[0.06] flex items-center justify-center">
                <Activity size={22} strokeWidth={1} className="text-[var(--text-secondary)]" />
              </div>
              <p className="authority-title !text-2xs opacity-30 tracking-wide max-w-xs">
                GÜNLÜK KIRILIM YALNIZCA 7 GÜNLÜK GÖRÜNÜMDE GÖSTERİLİR — AŞAĞIDAKİ TABLODA {periodDays} GÜNLÜK KİŞİ BAZLI ÖZETİ İNCELEYEBİLİRSİNİZ
              </p>
            </div>
          )}
        </motion.div>

        {/* TABLE: Kişi Bazlı Performans Özeti */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-12 spatial-glass !rounded-card p-8 sm:p-10 relative overflow-hidden shadow-[var(--spatial-shadow)] border border-[var(--text-primary)]/5"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <p className="authority-title !text-2xs opacity-40 font-bold tracking-wide">KİŞİ BAZLI PERFORMANS ÖZETİ — SON {periodDays} GÜN</p>
            <button
              type="button"
              onClick={handleExport}
              disabled={personnelStats.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--dynamic-aura,var(--aura-indigo))]/10 border border-[var(--dynamic-aura,var(--aura-indigo))]/20 text-[var(--dynamic-aura,var(--aura-indigo))] text-2xs font-bold uppercase tracking-wide disabled:opacity-30 transition-all"
            >
              <Download size={14} />
              Raporu Dışa Aktar (CSV)
            </button>
          </div>

          {personnelStats.length === 0 ? (
            <p className="text-2xs text-[var(--text-secondary)]/50 py-8 text-center">Bu dönemde kayıtlı görev bulunmuyor.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--glass-border)]">
                    <th className="pb-3 authority-title !text-2xs opacity-40 font-bold">Personel</th>
                    <th className="pb-3 authority-title !text-2xs opacity-40 font-bold text-right">Tamamlanan</th>
                    <th className="pb-3 authority-title !text-2xs opacity-40 font-bold text-right">Reddedilen</th>
                    <th className="pb-3 authority-title !text-2xs opacity-40 font-bold text-right">Toplam</th>
                    <th className="pb-3 authority-title !text-2xs opacity-40 font-bold text-right">Oran</th>
                  </tr>
                </thead>
                <tbody>
                  {personnelStats.map(p => (
                    <tr key={p.uid} className="border-b border-[var(--glass-border)] last:border-0">
                      <td className="py-3 text-xs text-[var(--text-primary)] font-medium">{p.displayName}</td>
                      <td className="py-3 text-xs text-[var(--text-secondary)] text-right">{p.completed}</td>
                      <td className="py-3 text-xs text-right">
                        <span className={p.rejected > 0 ? 'text-rose-500' : 'text-[var(--text-secondary)]'}>{p.rejected}</span>
                      </td>
                      <td className="py-3 text-xs text-[var(--text-secondary)] text-right">{p.total}</td>
                      <td className={`py-3 text-xs font-bold text-right ${
                        p.rate >= 80 ? 'text-emerald-500' : p.rate >= 60 ? 'text-amber-500' : 'text-rose-500'
                      }`}>
                        %{p.rate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
