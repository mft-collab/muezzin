import React, { useState, useMemo } from 'react';
import { format, startOfWeek, subWeeks, addWeeks, isSameDay, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useHaftaPlan } from '../hooks/useHaftaPlan';
import { useMuezzinStore } from '../store/useMuezzinStore';
import { auth } from '../lib/firebase';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vakit } from '../types';
import { useEzanVakitleri } from '../hooks/useEzanVakitleri';
import { useMevcutVakit } from '../hooks/useMevcutVakit';
import { IslamicGeometricBg } from '../components/ui/IslamicGeometricBg';
import { useHaftaBildirimleri } from '../hooks/useHaftaBildirimleri';
import { getHaftaIdFromDate, getTurkeyNow } from '../lib/dateUtils';

const VAKIT_LISTESI: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];

function pickCanonicalUid(values: string[]): string | null {
 const filtered = values.filter(Boolean);
 if (filtered.length === 0) return null;
 const counts = new Map<string, number>();
 filtered.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
 let best = filtered[0];
 let max = counts.get(best) || 0;
 counts.forEach((count, uid) => {
 if (count > max) {
 best = uid;
 max = count;
 }
 });
 return best;
}

export default function HaftalikTakvim() {
 // new Date() cihazın kendi saat dilimini kullanır — Türkiye dışı bir saat
 // diliminde açıldığında başlangıç haftası (ve "bugün" vurgusu) yanlış güne
 // kayabiliyordu (bkz. mantık denetimi, dateUtils.ts getTurkeyNow).
 const [currentDate, setCurrentDate] = useState(getTurkeyNow());
 const haftaId = getHaftaIdFromDate(format(currentDate, 'yyyy-MM-dd'));
 const { plan, loading: planLoading } = useHaftaPlan(haftaId);
 const { bildirimler: haftaBildirimleri, loading: bildirimLoading } = useHaftaBildirimleri(haftaId);
 const muezzinMap = useMuezzinStore(s => s.muezzinMap);
 const usersLoading = useMuezzinStore(s => s.loading);
 const currentUser = auth.currentUser;

 const { bugunVakitler } = useEzanVakitleri();
 const mevcutVakit = useMevcutVakit(bugunVakitler);

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

 const loading = planLoading || usersLoading || bildirimLoading;

 const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
 const weekLabel = `${format(currentWeekStart, 'd MMMM', { locale: tr })}`;

 const getMuezzinName = (uid: string) => {
 if (!uid) return 'Atanmamış';
 if (uid === 'SISTEM' || uid === 'Sistem') return 'Dizge';
 return muezzinMap[uid]?.displayName || 'Bilinmiyor';
 };

 const isAssignableUid = (uid: string | undefined) => {
 if (!uid || uid === 'Sistem' || uid === 'SISTEM') return true;
 const person = muezzinMap[uid];
 return !!person && person.aktif === true && person.role === 'muezzin';
 };

 const gunlukVeriler = useMemo(() => {
    if (!plan) return [];

    return Array.from({ length: 7 }).map((_, idx) => {
      const parsedDate = addDays(currentWeekStart, idx);
      const tarih = format(parsedDate, 'yyyy-MM-dd');
      const gunObj = plan.gunler[tarih] || {};
      // new Date() cihazın kendi saat dilimini kullanır — uygulama Türkiye'ye
      // özel bir hizmet olduğundan (bkz. dateUtils.ts getTurkeyNow), "bugün"
      // vurgusu cihaz Türkiye dışı bir saat diliminde olduğunda yanlış güne
      // düşebiliyordu (bkz. mantık denetimi).
      const isToday = isSameDay(parsedDate, getTurkeyNow());
      const gunAdi = format(parsedDate, 'EEEE', { locale: tr });
      const gunAyi = format(parsedDate, 'MMMM', { locale: tr });

      const getLiveUid = (vakit: Vakit, tip: 'asil' | 'yedek', fallbackUid: string | undefined) => {
        return haftaBildirimleri.find(b =>
          b.tarih === tarih &&
          b.vakit === vakit &&
          b.tip === tip &&
          b.durum !== 'reddedildi'
        )?.uid || fallbackUid;
      };

      const asilGunlukListe = VAKIT_LISTESI
        .map(v => getLiveUid(v, 'asil', gunObj[v]?.asil))
        .filter((uid): uid is string => !!uid && isAssignableUid(uid));
      const yedekGunlukListe = VAKIT_LISTESI
        .map(v => getLiveUid(v, 'yedek', gunObj[v]?.yedek))
        .filter((uid): uid is string => !!uid && isAssignableUid(uid));
      const asilCanonical = pickCanonicalUid(asilGunlukListe);
      const yedekCanonical = pickCanonicalUid(yedekGunlukListe);
      const asiller = asilCanonical ? [asilCanonical] : [];
      const yedekler = yedekCanonical ? [yedekCanonical] : [];
      const isPersonalDuty = !!(currentUser && (asilCanonical === currentUser.uid || yedekCanonical === currentUser.uid));

      return {
        tarih,
        parsedDate,
        isToday,
        gunAdi,
        gunAyi,
        asiller,
        yedekler,
        isPersonalDuty,
      };
    });
  }, [plan, currentWeekStart, currentUser, muezzinMap, haftaBildirimleri]);

 return (
 <div className="w-full min-h-screen bg-[var(--app-bg)] relative overflow-hidden transition-colors duration-[3000ms]">
 
 {/* Dynamic Ambient Auras (Sirkadiyen Geçiş) */}
 <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
 <div 
 className="absolute top-[10%] left-[-15%] w-[60%] h-[60%] blur-[200px] rounded-full animate-aura transition-all duration-[3000ms]" 
 style={{ 
 background: `radial-gradient(circle, ${auraColor} 0%, transparent 70%)` 
 }}
 />
 <div 
 className="absolute bottom-[10%] right-[-15%] w-[60%] h-[60%] blur-[200px] rounded-full animate-aura transition-all duration-[3000ms]" 
 style={{ 
 background: `radial-gradient(circle, ${secondaryAuraColor} 0%, transparent 70%)`,
 animationDelay: '-4s'
 }}
 />
 </div>

 <IslamicGeometricBg />

 <div className="w-full max-w-7xl mx-auto px-0 md:px-8 pb-32 min-h-screen relative z-10">
 <header className="relative z-10 mb-10 pt-10 md:pt-16 px-6 md:px-0">
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
 <div className="flex-1">
 <motion.div 
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 className="flex items-center gap-2 mb-3"
 >
 <div className="w-1 h-1 rounded-full bg-[var(--aura-indigo)] animate-pulse" />
 <span className="premium-label !text-2xs !opacity-40 uppercase tracking-wide">
 GÖREV TAKVİMİ
 </span>
 </motion.div>
 <motion.h1 
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
 className="text-3xl md:text-4xl font-light text-[var(--text-primary)] tracking-tight leading-none apple-thin"
 >
 Haftalık Görev Akışı
 </motion.h1>
 </div>
 
 <motion.div 
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 className="flex items-center bg-[var(--text-primary)]/[0.03] p-1.5 rounded-[20px] border border-[var(--glass-border)] backdrop-blur-3xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] self-start"
 >
 <motion.button
 whileTap={{ scale: 0.9 }}
 onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
 aria-label="Önceki hafta"
 className="w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.05] rounded-2xl transition-all"
 >
 <ChevronLeft size={18} />
 </motion.button>
 <div className="px-6 py-2 text-2xs font-bold tracking-wide text-[var(--text-secondary)] uppercase min-w-[180px] text-center">
 {weekLabel} – {format(addWeeks(currentWeekStart, 1), 'd MMMM', { locale: tr })}
 </div>
 <motion.button
 whileTap={{ scale: 0.9 }}
 onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
 aria-label="Sonraki hafta"
 className="w-10 h-10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.05] rounded-2xl transition-all"
 >
 <ChevronRight size={18} />
 </motion.button>
 </motion.div>
 </div>
 </header>

 <AnimatePresence mode="wait">
  {loading && !plan ? (
  <motion.div 
  key="loading"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="relative z-10 flex flex-col gap-4 px-4 md:px-0"
  >
  {Array.from({ length: 3 }).map((_, i) => (
  <div key={i} className="spatial-glass p-6 md:p-8 rounded-card border-[var(--glass-border)] flex flex-col md:flex-row gap-8 opacity-50">
  <div className="flex gap-6 items-center">
  <div className="w-16 h-16 rounded-2xl bg-[var(--text-primary)]/5 animate-pulse" />
  <div className="flex flex-col gap-2">
  <div className="w-32 h-6 bg-[var(--text-primary)]/5 rounded-full animate-pulse" />
  <div className="w-20 h-3 bg-[var(--text-primary)]/5 rounded-full animate-pulse" />
  </div>
  </div>
  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8">
  <div className="space-y-4">
  <div className="w-24 h-2 bg-[var(--text-primary)]/5 rounded-full animate-pulse" />
  <div className="w-full h-10 bg-[var(--text-primary)]/5 rounded-xl animate-pulse" />
  </div>
  <div className="space-y-4">
  <div className="w-24 h-2 bg-[var(--text-primary)]/5 rounded-full animate-pulse" />
  <div className="w-full h-10 bg-[var(--text-primary)]/5 rounded-xl animate-pulse" />
  </div>
  </div>
  </div>
  ))}
  </motion.div>
 ) : !plan ? (
 <motion.div 
 key="no-plan"
 initial={{ opacity: 0, scale: 0.98 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0 }}
 className="relative z-10 spatial-glass p-16 rounded-card text-center max-w-4xl mx-auto shadow-[var(--spatial-shadow)] border-[var(--glass-border)]"
 >
 <div className="w-24 h-24 bg-[var(--text-primary)]/[0.03] rounded-[32px] flex items-center justify-center mb-10 mx-auto border border-[var(--glass-border)]">
 <Info size={40} className="text-[var(--text-secondary)] opacity-20" />
 </div>
 <h3 className="text-4xl font-light text-[var(--text-primary)] mb-6 tracking-tight apple-thin">Plan Henüz Hazır Değil</h3>
 <p className="text-[var(--text-secondary)]/75 text-sm font-light leading-relaxed max-w-sm mx-auto mb-12">
 Seçilen haftaya ait görev dağılımı henüz onaylanmamış veya sisteme girilmemiş olabilir.
 </p>
 <motion.button 
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => setCurrentDate(new Date())}
 className="px-10 py-5 bg-[var(--text-primary)] text-[var(--app-bg)] rounded-2xl text-2xs font-bold uppercase tracking-wide shadow-[var(--spatial-shadow)]"
 >
 GÜNCEL HAFTAYA DÖN
 </motion.button>
 </motion.div>
 ) : (
 <motion.div 
 key="plan"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="relative z-10 flex flex-col gap-4 px-4 md:px-0"
 >
  {gunlukVeriler.map((dayData, idx) => {
    const { tarih, parsedDate, isToday, gunAdi, gunAyi, asiller, yedekler, isPersonalDuty } = dayData;

    return (
 <motion.div 
 key={tarih}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: idx * 0.05 }}
 className={`group relative p-6 md:p-8 rounded-card transition-all duration-700 overflow-hidden ${
 isToday 
 ? 'spatial-glass border-[var(--status-info)]/30 spatial-glow-primary bg-[var(--status-info)]/[0.03]' 
 : isPersonalDuty
 ? 'spatial-glass border-[var(--status-warning)]/30 spatial-glow-amber bg-[var(--status-warning)]/[0.02]'
 : 'spatial-glass hover:bg-[var(--text-primary)]/[0.02] border-[var(--glass-border)]'
 }`}
 >
 {/* Left status pillar for today */}
 {isToday && (
 <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full bg-[var(--status-info)] shadow-[0_0_12px_var(--status-info)]" />
 )}
 {isPersonalDuty && !isToday && (
 <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full bg-[var(--status-warning)] shadow-[0_0_12px_var(--status-warning)]" />
 )}
 <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative z-10">
 {/* Tarih Bloğu */}
 <div className="flex items-center gap-6 min-w-[180px]">
 <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border shadow-inner transition-all duration-700 ${
 isToday ? 'bg-[var(--status-info)]/20 border-[var(--status-info)]/30 text-[var(--status-info)]' 
 : isPersonalDuty ? 'bg-[var(--status-warning)]/20 border-[var(--status-warning)]/30 text-[var(--status-warning)]' 
 : 'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-[var(--text-secondary)]'
 }`}>
 <span className="text-2xl font-sans font-light leading-none">{format(parsedDate, 'd')}</span>
 <span className="text-2xs font-bold uppercase tracking-wider mt-1">{gunAyi?.substring(0, 3)?.toUpperCase()}</span>
 </div>
 <div>
 <h4 className={`text-xl font-light tracking-tight apple-thin ${isToday ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
 {gunAdi}
 </h4>
 {isToday && (
 <div className="flex items-center gap-2 mt-1">
 <div className="w-1 h-1 rounded-full bg-[var(--status-info)] shadow-[0_0_8px_var(--status-info)]" />
 <span className="text-2xs font-bold uppercase tracking-wide text-[var(--status-info)]">BUGÜN</span>
 </div>
 )}
 {isPersonalDuty && !isToday && (
 <div className="flex items-center gap-2 mt-1">
 <div className="w-1 h-1 rounded-full bg-[var(--status-warning)] shadow-[0_0_8px_var(--status-warning)]" />
 <span className="text-2xs font-bold uppercase tracking-wide text-[var(--status-warning)]">GÖREVİNİZ VAR</span>
 </div>
 )}
 </div>
 </div>

 {/* Görevli Listesi */}
 <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-8 w-full md:pl-10 border-[var(--glass-border)] md:border-l">
 {/* Asil Görevliler */}
 <div className="space-y-4">
 <span className="premium-label !text-2xs !opacity-20">ASİL GÖREVLİLER</span>
 <div className="flex flex-wrap gap-2">
 {asiller.length > 0 ? (asiller as string[]).map((uid) => (
 <div 
 key={uid} 
 className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-500 ${
 uid === currentUser?.uid 
 ? 'bg-[var(--status-warning)]/20 border-[var(--status-warning)]/30 text-[var(--status-warning)] shadow-lg shadow-[var(--status-warning)]/10' 
 : 'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-[var(--text-secondary)]'
 }`}
 >
 {getMuezzinName(uid)}
 </div>
 )) : (
 <span className="text-xs text-[var(--text-secondary)] opacity-10 font-light italic">Atanmamış</span>
 )}
 </div>
 </div>

 {/* Yedek Görevliler */}
 <div className="space-y-4">
 <span className="premium-label !text-2xs !opacity-20">YEDEK GÖREVLİLER</span>
 <div className="flex flex-wrap gap-2">
 {yedekler.length > 0 ? (yedekler as string[]).map((uid) => (
 <div 
 key={uid} 
 className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-500 ${
 uid === currentUser?.uid 
 ? 'bg-[var(--status-warning)]/20 border-[var(--status-warning)]/30 text-[var(--status-warning)] shadow-lg shadow-[var(--status-warning)]/10' 
 : 'bg-[var(--text-primary)]/[0.03] border-[var(--glass-border)] text-[var(--text-secondary)]'
 }`}
 >
 {getMuezzinName(uid)}
 </div>
 )) : (
 <span className="text-xs text-[var(--text-secondary)] opacity-10 font-light italic">Atanmamış</span>
 )}
 </div>
 </div>
 </div>
 </div>

 <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
 </motion.div>
 );
 })}
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 );
}
