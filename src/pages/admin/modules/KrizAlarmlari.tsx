import React from 'react';
import { useKrizAlarmlariStore } from '../../../store/useKrizAlarmlariStore';
import { AlertTriangle, ServerCrash, CalendarX, CheckCircle, RefreshCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { VAKIT_GORA_ISIMLERI } from '../../../lib/dateUtils';
import { Vakit, AdminUyarisi } from '../../../types';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AdminLoadingState } from '../components/AdminLoadingState';
import { kriziBaslat } from '../../../services/mazeretServisi';
import { useNotificationStore } from '../../../store/useNotificationStore';

export default function KrizAlarmlari() {
 const { alarmlar, loading, alarmCoz } = useKrizAlarmlariStore();
 const showNotification = useNotificationStore(s => s.showNotification);
 const [showResolved, setShowResolved] = React.useState(false);
 const [resolvingId, setResolvingId] = React.useState<string | null>(null);
 const [confirmData, setConfirmData] = React.useState<{ open: boolean, alarm: (AdminUyarisi & { id: string }) | null }>({ open: false, alarm: null });
 const [isRetrying, setIsRetrying] = React.useState<string | null>(null);

 const handleResolveRequest = (alarm: AdminUyarisi & { id: string }) => {
 setConfirmData({ open: true, alarm });
 };

  const executeResolve = async () => {
    const alarm = confirmData.alarm;
    if (!alarm) return;

    setResolvingId(alarm.id);
    setConfirmData({ open: false, alarm: null });

    try {
      await alarmCoz(alarm.id, 'Nöbet Uyarısı Arşivleme', `Nöbet uyarısı yönetici tarafından çözüldü olarak işaretlendi ve arşivlendi. Mesaj: "${alarm.mesaj}"`);
    } catch (err) {
      // Önceden yalnızca console.error'a düşüyordu — admin, işlem
      // başarısız olduğunda düğmenin dönmeyi bırakmasından başka hiçbir
      // gösterge görmüyor, alarmın çözüldüğünü sanabiliyordu (bkz. mimari
      // denetim).
      console.error("Vaka giderme hatası:", err);
      showNotification('Hata', err instanceof Error ? err.message : 'Uyarı çözülürken bir hata oluştu.', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleRetry = async (alarm: AdminUyarisi & { id: string }) => {
    if (!alarm.tarih || !alarm.vakit) return;
    setIsRetrying(alarm.id);
    try {
      const success = await kriziBaslat(alarm.tarih, alarm.vakit, []);
      if (success) {
        await alarmCoz(alarm.id, 'Otomatik Nöbet Onarımı', 'Eşik dışı nöbet zinciri dizge tarafından otomatik onarıldı ve yedek görevli devraldı.');
      } else {
        showNotification('Onarılamadı', 'Bu vakit için uygun bir yedek görevli bulunamadı.', 'warning');
      }
    } catch (err) {
      console.error("Retry error:", err);
      showNotification('Hata', err instanceof Error ? err.message : 'Otomatik onarım sırasında bir hata oluştu.', 'error');
    } finally {
      setIsRetrying(null);
    }
  };

 const getIcon = (tip: string) => {
 switch (tip) {
 case 'zincirTukendi': return <AlertTriangle size={24} />;
 case 'apiHatasi': return <ServerCrash size={24} />;
 case 'planOlusturulamadi': return <CalendarX size={24} />;
 // scripts/lib/reportWorkflowFailure.ts — bir GitHub Actions cron işinin
 // (aylık ezan takvimi, log temizliği, yatsı sonu, haftalık plan, vakit
 // sağlığı) çökmesi; 'apiHatasi'dan (dış API'ye ulaşılamıyor) kasıtlı
 // olarak AYRI bir kategori (bkz. kod denetimi — önceden hepsi 'apiHatasi'
 // altında ayrıştırılamıyordu).
 case 'otomasyonHatasi': return <RefreshCcw size={24} />;
 default: return <AlertTriangle size={24} />;
 }
 };

 const getAlertColor = (tip: string) => {
 switch (tip) {
 case 'zincirTukendi': return 'rose';
 case 'apiHatasi': return 'amber';
 case 'planOlusturulamadi': return 'indigo';
 case 'otomasyonHatasi': return 'indigo';
 default: return 'rose';
 }
 };

 if (loading) return <AdminLoadingState label="Nöbet Uyarıları Yükleniyor" size="lg" />;

 const filteredAlarmlar = showResolved ? alarmlar : alarmlar.filter(a => !a.cozuldu);

 const colorMap = {
 rose: {
 bg: 'bg-rose-500/[0.03]',
 bgHover: 'hover:bg-rose-500/[0.05]',
 border: 'border-rose-500/20',
 aura: 'from-rose-500/10',
 iconBg: 'bg-rose-500/10',
 iconText: 'text-rose-400',
 iconBorder: 'border-rose-500/20',
 iconShadow: 'shadow-rose-500/5',
 typeText: 'text-rose-500',
 badgeBg: 'bg-rose-500/10',
 badgeText: 'text-rose-400',
 badgeBorder: 'border-rose-500/20',
 buttonBg: 'bg-rose-500'
 },
 amber: {
 bg: 'bg-amber-500/[0.03]',
 bgHover: 'hover:bg-amber-500/[0.05]',
 border: 'border-amber-500/20',
 aura: 'from-amber-500/10',
 iconBg: 'bg-amber-500/10',
 iconText: 'text-amber-400',
 iconBorder: 'border-amber-500/20',
 iconShadow: 'shadow-amber-500/5',
 typeText: 'text-amber-500',
 badgeBg: 'bg-amber-500/10',
 badgeText: 'text-amber-400',
 badgeBorder: 'border-amber-500/20',
 buttonBg: 'bg-amber-500'
 },
 indigo: {
 bg: 'bg-[var(--dynamic-aura,var(--aura-indigo))]/[0.03]',
 bgHover: 'hover:bg-[var(--dynamic-aura,var(--aura-indigo))]/[0.05]',
 border: 'border-[var(--dynamic-aura,var(--aura-indigo))]/20',
 aura: 'from-[var(--dynamic-aura,var(--aura-indigo))]/10',
 iconBg: 'bg-[var(--dynamic-aura,var(--aura-indigo))]/10',
 iconText: 'text-[var(--dynamic-aura,var(--aura-indigo))]',
 iconBorder: 'border-[var(--dynamic-aura,var(--aura-indigo))]/20',
 iconShadow: '',
 typeText: 'text-[var(--dynamic-aura,var(--aura-indigo))]',
 badgeBg: 'bg-[var(--dynamic-aura,var(--aura-indigo))]/10',
 badgeText: 'text-[var(--dynamic-aura,var(--aura-indigo))]',
 badgeBorder: 'border-[var(--dynamic-aura,var(--aura-indigo))]/20',
 buttonBg: 'bg-[var(--dynamic-aura,var(--aura-indigo))]'
 }
 };

 return (
 <div className="flex flex-col gap-10">
 {/* TOOLBAR: Operational Toggle */}
 <div className="flex justify-between items-center">
 <div className="flex flex-col gap-2">
 <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Nöbet Uyarıları</h2>
 <p className="authority-title !text-2xs opacity-30 font-medium tracking-wide">NÖBET VE VAKİT AKIŞI TAKİBİ</p>
 </div>

 <motion.button 
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 onClick={() => setShowResolved(!showResolved)}
 className={`flex items-center gap-4 px-6 py-3 rounded-2xl border transition-all duration-700 ${
 showResolved 
 ? 'bg-[var(--dynamic-aura,var(--aura-indigo))]/10 border-[var(--dynamic-aura,var(--aura-indigo))]/30 text-[var(--dynamic-aura,var(--aura-indigo))]' 
 : 'bg-[var(--text-primary)]/[0.03] border-[var(--text-primary)]/5 text-[var(--text-secondary)]'
 }`}
 >
 <span className="authority-title !text-2xs font-bold tracking-wide uppercase">ARŞİVLENMİŞ UYARILAR</span>
 <div className={`w-10 h-5 rounded-full relative transition-all duration-500 ${showResolved ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-[var(--text-primary)]/10'}`}>
 <motion.div 
 animate={{ x: showResolved ? 22 : 2 }}
 className="absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm" 
 />
 </div>
 </motion.button>
 </div>

 {filteredAlarmlar.length === 0 && (
 <EmptyState
 icon={<CheckCircle size={36} strokeWidth={1.2} />}
 title="Uyarı Bulunmuyor"
 description="ŞU ANDA MÜDAHALE GEREKTİREN AKTİF BİR NÖBET UYARISI BULUNMUYOR."
 tone="emerald"
 size="lg"
 />
 )}

 {/* ALERT GRID: War Room Matrix */}
 <div className="grid grid-cols-1 gap-4">
 <AnimatePresence mode="popLayout">
 {filteredAlarmlar.map((alarm, idx) => {
 const color = getAlertColor(alarm.tip) as keyof typeof colorMap;
 const styles = colorMap[color];

 return (
 <motion.div 
 key={alarm.id} 
 layout
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ type: "spring", stiffness: 400, damping: 30, delay: idx * 0.05 }}
 className={`relative overflow-hidden p-6 rounded-card border transition-all duration-700 group ${
 alarm.cozuldu 
 ? 'spatial-glass opacity-30 border-[var(--text-primary)]/5' 
 : `${styles.bg} ${styles.border} shadow-[var(--spatial-shadow)] ${styles.bgHover}`
 }`}
 >
 {!alarm.cozuldu && (
 <motion.div 
 animate={{ opacity: [0.1, 0.4, 0.1] }}
 transition={{ repeat: Infinity, duration: 3 }}
 className={`absolute inset-0 bg-gradient-to-r ${styles.aura} to-transparent pointer-events-none`} 
 />
 )}
 
 <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center gap-8">
 {/* Icon Identity */}
 <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center shrink-0 shadow-lg border ${
 alarm.cozuldu ? 'bg-[var(--text-primary)]/5 text-[var(--text-secondary)] border-[var(--text-primary)]/5' : `${styles.iconBg} ${styles.iconText} ${styles.iconBorder} ${styles.iconShadow}`
 }`}>
 {getIcon(alarm.tip)}
 </div>

 {/* Content Matrix */}
 <div className="flex-1 flex flex-col gap-2">
 <div className="flex items-center gap-4">
 <span className={`authority-title !text-2xs font-bold tracking-wide uppercase ${alarm.cozuldu ? 'text-[var(--text-secondary)]/30' : styles.typeText}`}>
 {alarm.tip === 'zincirTukendi' ? 'VERİ ZİNCİRİ KESİNTİSİ' :
 alarm.tip === 'apiHatasi' ? 'API BAĞLANTI ARIZASI' :
 alarm.tip === 'planOlusturulamadi' ? 'PLANLAMA UYARISI' :
 alarm.tip === 'otomasyonHatasi' ? 'OTOMASYON HATASI' : 'NÖBET UYARISI'}
 </span>
 {!alarm.cozuldu && (
 <div className={`px-3 py-1 rounded-xl ${styles.badgeBg} ${styles.badgeText} text-2xs font-bold tracking-wide border ${styles.badgeBorder} animate-pulse`}>
 ACİL MÜDAHALE
 </div>
 )}
 </div>
 
 <div className="flex items-center gap-4 mt-1">
 <div className="flex items-center gap-2">
 <span className="authority-title !text-2xs opacity-20 uppercase tracking-wide">TARİH/VAKİT</span>
 <span className={`text-2xs font-bold tracking-wide ${alarm.cozuldu ? 'text-[var(--text-secondary)]/30' : 'text-[var(--text-secondary)]/60'}`}>
 {/* alarm.tarih bir "YYYY-MM-DD" tarih-anahtarı string'i — new Date(...)
 UTC gece yarısı olarak ayrıştırır (Türkiye'nin sabit UTC+3'ü nedeniyle
 bugün görünürde zararsız ama farklı bir TZ'de yanlış günü gösterir),
 kod tabanının her yerde kullandığı parseISO kuralına aykırıydı (bkz.
 MazeretGecmisi.tsx, beşinci denetim turu). */}
 {alarm.tarih ? format(parseISO(alarm.tarih), 'dd MMMM yyyy', { locale: tr }) : '--'}
 {alarm.vakit ? ` • ${VAKIT_GORA_ISIMLERI[alarm.vakit as Vakit]}` : ''}
 </span>
 </div>
 </div>

 <p className={`text-base font-light leading-relaxed mt-2 max-w-4xl ${alarm.cozuldu ? 'text-[var(--text-secondary)]/20' : 'text-[var(--text-secondary)]/60 italic'}`}>
 "{alarm.mesaj}"
 </p>
 </div>
 
 {/* Action Matrix */}
 {!alarm.cozuldu && (
 <div className="flex items-center gap-4 shrink-0">
 {alarm.tip === 'zincirTukendi' && (
 <motion.button 
 whileHover={{ y: -4, scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 disabled={isRetrying === alarm.id}
 onClick={() => handleRetry(alarm)}
 className={`${styles.buttonBg} text-[var(--text-primary)] px-8 py-5 rounded-2xl text-2xs font-bold uppercase tracking-wide shadow-lg flex items-center gap-4 disabled:opacity-50`}
 >
 <RefreshCcw size={16} className={isRetrying === alarm.id ? 'animate-spin' : ''} />
 {isRetrying === alarm.id ? 'ONARILIYOR...' : 'DİZGEYİ ONAR'}
 </motion.button>
 )}
 
 <motion.button 
 whileHover={{ y: -4, scale: 1.02, backgroundColor: 'var(--surface-low)' }}
 whileTap={{ scale: 0.98 }}
 disabled={resolvingId === alarm.id}
 onClick={() => handleResolveRequest(alarm)}
 className="px-8 py-5 text-2xs font-bold uppercase tracking-wide text-[var(--text-secondary)]/40 hover:text-[var(--text-primary)] transition-all border border-[var(--glass-border)] rounded-2xl"
 >
 {resolvingId === alarm.id ? 'İŞLENİYOR...' : 'ÇÖZÜLDÜ OLARAK İŞARETLE'}
 </motion.button>
 </div>
 )}
 </div>
 </motion.div>
 );
 })}
 </AnimatePresence>
 </div>

 <ConfirmModal 
 isOpen={confirmData.open}
 onClose={() => setConfirmData({ open: false, alarm: null })}
 onConfirm={executeResolve}
 title="Uyarıyı Çözüldü Olarak İşaretle"
 message={confirmData.alarm ? `${confirmData.alarm.tip === 'zincirTukendi' ? 'Nöbet Zinciri Tükendi' : 'Nöbet Uyarısı'} başlıklı kaydı arşivlemek üzeresiniz. Lütfen gerekli önlemlerin alındığından emin olun.` : ''}
 confirmText="EVET, ARŞİVLE"
 isDanger={false}
 />
 </div>
 );
}
