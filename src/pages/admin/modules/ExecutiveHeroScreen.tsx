import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, CalendarClock, Activity, ChevronRight, Check, X, ClipboardCheck, Megaphone } from 'lucide-react';
import { useKrizAlarmlariStore } from '../../../store/useKrizAlarmlariStore';
import { useAdminIzinlerStore } from '../../../store/useAdminIzinlerStore';
import { useMuezzinStore } from '../../../store/useMuezzinStore';
import { useNotificationStore } from '../../../store/useNotificationStore';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { LiveClock } from '../../../components/LiveClock';
import { useHaftaPlan } from '../../../hooks/useHaftaPlan';
import { useHaftaBildirimleri } from '../../../hooks/useHaftaBildirimleri';
import { getHaftaIdFromDate, getTurkeyDateString, izinOnayCumaEngelMesaji } from '../../../lib/dateUtils';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { type ActiveModule } from '../config/navConfig';


interface HeroScreenProps {
 muezzinlerSayisi: number;
 cozulmamisSayisi: number;
 pendingIzinler: number;
 /** İlgili store'ların Firestore'dan ilk snapshot'ı henüz vermediğini belirtir —
  * true iken ham "0" yerine yükleniyor iskeleti gösterilir (bkz. tasarım denetimi). */
 statsLoading: boolean;
 setActiveTab: (tab: ActiveModule, subtab?: string) => void;
 onOpenDrawer: (content: 'alarmlar' | 'duyurular' | null) => void;
}

function HeroStatSkeleton({ className }: { className: string }) {
 return <div className={`fluid-skeleton ${className}`} />;
}

export default function ExecutiveHeroScreen({
 muezzinlerSayisi,
 cozulmamisSayisi,
 pendingIzinler,
 statsLoading,
 setActiveTab,
 onOpenDrawer
}: HeroScreenProps) {
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [processingId, setProcessingId] = useState<string | null>(null);
 const [decisionConfirm, setDecisionConfirm] = useState<{ open: boolean; id: string | null; durum: 'onaylandi' | 'reddedildi' | null; title: string }>(
 { open: false, id: null, durum: null, title: '' }
 );
 const alarmlar = useKrizAlarmlariStore(s => s.alarmlar);
 const izinler = useAdminIzinlerStore(s => s.izinler);
 const izinGuncelle = useAdminIzinlerStore(s => s.izinGuncelle);
 const izinGeriAl = useAdminIzinlerStore(s => s.izinGeriAl);
 const muezzinMap = useMuezzinStore(s => s.muezzinMap);
 const showNotification = useNotificationStore(s => s.showNotification);

 const kararVer = async (id: string, durum: 'onaylandi' | 'reddedildi', title: string) => {
 setProcessingId(id);
 try {
 await izinGuncelle(id, durum);
 showNotification(
 durum === 'onaylandi' ? 'İzin Onaylandı' : 'İzin Reddedildi',
 title,
 durum === 'onaylandi' ? 'success' : 'warning',
 {
 action: {
 label: 'Geri Al',
 onClick: () => {
 izinGeriAl(id).catch(() => {
 showNotification('Geri Alma Başarısız', 'Karar geri alınamadı, lütfen tekrar deneyin.', 'error');
 });
 }
 },
 durationMs: 8000
 }
 );
 } catch (err) {
 // Yıllık izin kotasını aşan bir onay burada anlamlı bir hata mesajıyla
 // (bkz. useAdminIzinlerStore.ts izinGuncelle) reddedilir — genel mesaj
 // bu bilgiyi gizleyip admin'in nedeni anlamasını engellerdi.
 showNotification('İşlem Başarısız', err instanceof Error ? err.message : 'İzin kararı işlenemedi. Bağlantı veya yetki durumunu kontrol edin.', 'error');
 } finally {
 setProcessingId(null);
 }
 };
 const haftaId = useMemo(() => getHaftaIdFromDate(getTurkeyDateString()), []);
 const { plan, loading: planLoading } = useHaftaPlan(haftaId);
 const { bildirimler: haftaBildirimleri, loading: bildirimLoading } = useHaftaBildirimleri(haftaId);
 const planHazir = Boolean(plan);
 const bekleyenOnaySayisi = haftaBildirimleri.filter(b => b.durum === 'bekliyor').length;
 const haftalikGorevSayisi = haftaBildirimleri.length;
 const planStatusLabel = planLoading || bildirimLoading
  ? 'Yükleniyor'
  : planHazir
    ? bekleyenOnaySayisi > 0
      ? 'Onay bekliyor'
      : 'Yayında'
    : 'Plan yok';

 const combinedOperations: {
 id: string; title: string; status: string; time: string; type: 'alarm' | 'izin';
 // Cuma-kapsayan yıllık/haftalık izin onayını engelleyebilmek için
 // yalnızca 'izin' tipindeki kayıtlarda dolu (bkz. onay düğmesi onClick'i)
 // — IzinYonetimi.tsx'in dedike ekranı bu kontrolü zaten yapıyordu, bu
 // hızlı-onay yolu yapmıyordu (bkz. code-review, dördüncü denetim turu).
 tip?: string; baslangic?: string; bitis?: string;
 }[] = [
 ...alarmlar.slice(0, 5).map(a => ({
 id: a.id,
 title: a.mesaj,
 status: a.cozuldu ? 'completed' : 'active',
 time: a.olusturmaTarihi ? formatDistanceToNow(a.olusturmaTarihi.toDate(), { addSuffix: true, locale: tr }) : 'Az önce',
 type: 'alarm' as const
 })),
 ...izinler.filter(i => i.durum === 'onay_bekliyor').slice(0, 5).map(i => ({
 id: i.id,
 title: `${muezzinMap[i.uid]?.displayName || 'Bilinmiyor'} - İzin Talebi`,
 status: 'pending',
 time: i.olusturmaTarihi ? formatDistanceToNow(i.olusturmaTarihi.toDate(), { addSuffix: true, locale: tr }) : 'Az önce',
 type: 'izin' as const,
 tip: i.tip,
 baslangic: i.baslangic,
 bitis: i.bitis
 }))
 ].sort((a, b) => {
 // Nöbet uyarıları izin taleplerinden önce görünür.
 const weight = { alarm: 0, izin: 1 };
 return weight[a.type as keyof typeof weight] - weight[b.type as keyof typeof weight];
 });

 return (
 <div className="w-full flex flex-col gap-12">
 {/* HEADER SECTION: Executive Calm */}
 <motion.header 
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 className="flex flex-col lg:flex-row lg:items-end justify-between gap-8"
 >
 <div className="flex flex-col gap-4">
 <div className="flex items-center gap-3">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
 <span className="authority-title !text-2xs !text-emerald-500 font-medium">CANLI DİZGE DURUMU</span>
 </div>
 <h1 className="text-3xl lg:text-5xl font-light text-[var(--text-primary)] tracking-tight leading-none max-w-2xl group-hover:font-medium transition-all duration-1000">
 Yönetim <span className="text-[var(--dynamic-aura,var(--aura-indigo))] italic">Senkronize</span> ve <span className="font-normal group-hover:font-bold transition-all duration-1000">Aktif.</span>
 </h1>
 </div>
 
 <div className="flex items-center gap-10 px-8 py-4 spatial-glass border border-[var(--glass-border)]">
 <div className="flex flex-col items-end">
 <LiveClock className="text-2xl font-light text-[var(--text-primary)] tracking-tighter leading-none" />
 <span className="authority-title !text-2xs opacity-30 mt-2">YEREL ZAMAN</span>
 </div>
 </div>
 </motion.header>

 {/* BENTO GRID: Immersive Layout */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
 
 {/* Large Tile: Kadro Durumu */}
 <motion.div
 whileHover={{ y: -5, scale: 1.005 }}
 whileTap={{ scale: 0.995 }}
 transition={{ type: 'spring', stiffness: 280, damping: 22 }}
 onClick={() => setActiveTab('ekip')}
 className="col-span-1 md:col-span-1 lg:col-span-7 spatial-glass !rounded-card p-8 relative overflow-hidden group min-h-[300px] flex flex-col justify-between cursor-pointer shimmer-trigger"
 >
  <div className="kinetic-sheen" />
  <div className="absolute inset-0 bg-gradient-to-b from-[var(--text-primary)]/[0.02] via-transparent to-transparent pointer-events-none" />

  {/* Header */}
  <div className="relative z-10 flex items-center justify-between mb-6">
  <div className="w-12 h-12 rounded-2xl bg-[var(--dynamic-aura,var(--aura-indigo))]/10 flex items-center justify-center text-[var(--dynamic-aura,var(--aura-indigo))] border border-[var(--dynamic-aura,var(--aura-indigo))]/20 shadow-lg">
  <Activity size={24} strokeWidth={1.5} />
  </div>
  <span className="authority-title !text-2xs opacity-40 font-medium tracking-wide group-hover:font-bold transition-all duration-700">HİZMET KADROSU</span>
  </div>

  {/* Personnel Count — large number */}
  <div className="relative z-10 flex-1 flex flex-col justify-center">
  {statsLoading ? (
  <HeroStatSkeleton className="w-28 h-16 lg:h-20 mb-2" />
  ) : (
  <div className="text-6xl lg:text-8xl font-extralight text-[var(--text-primary)] tracking-tighter leading-none tabular-nums mb-2">
  {muezzinlerSayisi}
  </div>
  )}
  <span className="authority-title !text-2xs opacity-25 tracking-widest">AKTİF MÜEZZİN KADROSU</span>

  {/* Status bars */}
  <div className="mt-8 flex flex-col gap-3">
  <div className="flex items-center gap-4">
  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
  <div className="flex-1 h-[2px] rounded-full bg-[var(--glass-border)] overflow-hidden">
  <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: '100%' }} />
  </div>
  <span className="authority-title !text-2xs opacity-30 w-16 text-right">AKTİF</span>
  </div>
  <div className="flex items-center gap-4">
  <div className={`w-2 h-2 rounded-full ${cozulmamisSayisi > 0 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-[var(--glass-border)]'}`} />
  <div className="flex-1 h-[2px] rounded-full bg-[var(--glass-border)] overflow-hidden">
  <div className={`h-full rounded-full transition-all duration-1000 ${cozulmamisSayisi > 0 ? 'bg-rose-500/60' : 'bg-[var(--glass-border)]'}`}
  style={{ width: cozulmamisSayisi > 0 && muezzinlerSayisi > 0 ? `${Math.min((cozulmamisSayisi / muezzinlerSayisi) * 100, 100)}%` : '0%' }} />
  </div>
  <span className="authority-title !text-2xs opacity-30 w-16 text-right">UYARI</span>
  </div>
  <div className="flex items-center gap-4">
  <div className={`w-2 h-2 rounded-full ${pendingIzinler > 0 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-[var(--glass-border)]'}`} />
  <div className="flex-1 h-[2px] rounded-full bg-[var(--glass-border)] overflow-hidden">
  <div className={`h-full rounded-full transition-all duration-1000 ${pendingIzinler > 0 ? 'bg-amber-500/60' : 'bg-[var(--glass-border)]'}`}
  style={{ width: pendingIzinler > 0 && muezzinlerSayisi > 0 ? `${Math.min((pendingIzinler / muezzinlerSayisi) * 100, 100)}%` : '0%' }} />
  </div>
  <span className="authority-title !text-2xs opacity-30 w-16 text-right">BEKLEYEN</span>
  </div>
  </div>
  </div>

  <div className="relative z-10 flex items-center justify-between gap-4 mt-6 pt-4 border-t border-[var(--glass-border)]">
  <p className="authority-title !text-2xs opacity-35 font-medium tracking-wide">
  Nöbet alabilir aktif müezzin kadrosu
  </p>
  <ChevronRight size={18} className="text-[var(--text-primary)]/25 group-hover:text-[var(--dynamic-aura,var(--aura-indigo))] transition-colors" />
  </div>
  </motion.div>

 {/* Side Stack */}
 <div className="col-span-1 md:col-span-1 lg:col-span-5 flex flex-col gap-8">
 {/* Uyarı Tile */}
 <motion.div 
 whileHover={{ y: -4, scale: 1.01 }}
 whileTap={{ scale: 0.99 }}
 transition={{ type: 'spring', stiffness: 300, damping: 24 }}
 onClick={() => onOpenDrawer('alarmlar')}
 className={`flex-1 spatial-glass !rounded-card p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-700 cursor-pointer min-h-[140px] shimmer-trigger ${cozulmamisSayisi > 0 ? 'spatial-glass-elevated border-rose-500/30 bg-rose-500/[0.04]' : 'hover:bg-[var(--text-primary)]/[0.02]'}`}
 >
 <div className="kinetic-sheen" />
 <div className="flex items-center justify-between relative z-10">
 <div className={`relative flex flex-col items-center justify-center gap-2.5 w-[60px] h-[60px] rounded-[24px] transition-all duration-700 group z-10 ${cozulmamisSayisi > 0 ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-[var(--surface-low)] text-[var(--text-secondary)] border border-[var(--glass-border)]'}`}>
 <ShieldAlert size={20} strokeWidth={1.5} />
 </div>
 <div className="text-right">
 {statsLoading ? (
 <HeroStatSkeleton className="w-10 h-9 ml-auto" />
 ) : (
 <div className={`text-4xl font-light tracking-tighter leading-none ${cozulmamisSayisi > 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
 {cozulmamisSayisi}
 </div>
 )}
 <span className="authority-title !text-2xs opacity-40 mt-2 font-medium tracking-wide">NÖBET UYARILARI</span>
 </div>
 </div>
 {cozulmamisSayisi > 0 && (
 <div className="mt-4 pt-4 border-t border-rose-500/10 relative z-10">
 <p className="text-2xs font-bold text-rose-400 uppercase tracking-wide truncate">
 SON: {alarmlar[0]?.mesaj || 'Tespit Edilemedi'}
 </p>
 </div>
 )}
 </motion.div>

 {/* Leave & Announcements Row */}
 <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 flex-1">
 <motion.div
 whileHover={{ y: -4, scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 transition={{ type: 'spring', stiffness: 300, damping: 24 }}
 onClick={() => setActiveTab('ekip', 'mazeretler')}
 className="flex-1 spatial-glass !rounded-card p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-700 cursor-pointer min-h-[140px] shimmer-trigger"
 >
 <div className="kinetic-sheen" />
 <div className="flex items-center justify-between">
 <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg flex items-center justify-center">
 <CalendarClock size={18} strokeWidth={1.5} />
 </div>
 <div className="text-right">
 {statsLoading ? (
 <HeroStatSkeleton className="w-8 h-8 ml-auto" />
 ) : (
 <div className="text-3xl font-light text-[var(--text-primary)] tracking-tighter leading-none tabular-nums">
 {pendingIzinler}
 </div>
 )}
 <span className="authority-title !text-2xs opacity-40 mt-2 font-medium tracking-wide">BEKLEYEN İZİN</span>
 </div>
 </div>
  <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
  <p className="authority-title !text-2xs opacity-40 font-medium tracking-wide">AKTİF TALEPLER</p>
  </div>
 </motion.div>

 <motion.div
 whileHover={{ y: -4, scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 transition={{ type: 'spring', stiffness: 300, damping: 24 }}
 onClick={() => setActiveTab('planlama')}
 className="flex-1 spatial-glass !rounded-card p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-700 cursor-pointer min-h-[140px] shimmer-trigger"
 >
 <div className="kinetic-sheen" />
 <div className="flex items-center justify-between">
 <div className="w-10 h-10 rounded-2xl bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] border border-[var(--dynamic-aura,var(--aura-indigo))]/20 shadow-lg flex items-center justify-center">
 <ClipboardCheck size={18} strokeWidth={1.5} />
 </div>
 <div className="text-right">
 <div className={`text-2xl font-light tracking-tight leading-none tabular-nums ${
  !planHazir ? 'text-rose-500' : bekleyenOnaySayisi > 0 ? 'text-amber-500' : 'text-[var(--text-primary)]'
 }`}>
 {planStatusLabel}
 </div>
 <span className="authority-title !text-2xs opacity-40 mt-2 font-medium tracking-wide">HAFTALIK PLAN</span>
 </div>
 </div>
  <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
  <p className="text-2xs font-bold text-[var(--dynamic-aura,var(--aura-indigo))]/60 uppercase tracking-wide">
  {planHazir ? `${bekleyenOnaySayisi}/${haftalikGorevSayisi} görev onay bekliyor` : 'Planlama ekranına git'}
  </p>
  </div>
 </motion.div>

 <motion.div
 whileHover={{ y: -4, scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 transition={{ type: 'spring', stiffness: 300, damping: 24 }}
 onClick={() => onOpenDrawer('duyurular')}
 className="flex-1 spatial-glass !rounded-card p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-700 cursor-pointer min-h-[140px] shimmer-trigger"
 >
 <div className="kinetic-sheen" />
 <div className="flex items-center justify-between">
 <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-lg flex items-center justify-center">
 <Megaphone size={18} strokeWidth={1.5} />
 </div>
 <div className="text-right">
 <ChevronRight size={18} className="text-[var(--text-primary)]/25 ml-auto" />
 <span className="authority-title !text-2xs opacity-40 mt-2 font-medium tracking-wide">DUYURULAR</span>
 </div>
 </div>
  <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
  <p className="text-2xs font-bold text-emerald-500/60 uppercase tracking-wide">Duyuru panelini yönet</p>
  </div>
 </motion.div>
 </div>
 </div>
 </div>

 {/* LIVE STREAM TABLE: Contextual Intelligence */}
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.5, duration: 1 }}
 className="mt-6 flex flex-col gap-6"
 >
 <div className="flex items-center justify-between px-4">
 <div className="flex items-center gap-4">
 <div className="w-1 h-3 bg-[var(--dynamic-aura,var(--aura-indigo))] rounded-full shadow-[0_0_10px_rgb(99,102,241)]" />
 <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)] uppercase tracking-wide">Hizmet Akışı</h2>
 </div>
  <button
  onClick={() => setActiveTab('ekip')}
  className="authority-title !text-2xs !text-[var(--dynamic-aura,var(--aura-indigo))] cursor-pointer hover:text-[var(--text-primary)] transition-all flex items-center gap-2 group tracking-wide font-medium"
  >
  TÜMÜNÜ GÖR <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
  </button>
 </div>

 <div className="flex flex-col gap-4">
 <AnimatePresence>
 {combinedOperations.length > 0 ? (
 combinedOperations.map((record, idx) => {
 const isExpanded = expandedId === record.id;
 
 return (
 <motion.div
 layout
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ type: 'spring', damping: 25, stiffness: 200, delay: idx * 0.05 }}
 key={record.id}
 onClick={() => setExpandedId(isExpanded ? null : record.id)}
 className={`spatial-glass !rounded-card p-5 cursor-pointer group transition-all duration-500 relative overflow-hidden ${isExpanded ? 'spatial-glass-elevated border-[var(--dynamic-aura,var(--aura-indigo))]/30' : 'hover:bg-[var(--text-primary)]/[0.02]'}`}
 >
 {/* Item Sheen */}
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

 <motion.div layout className="flex items-center justify-between relative z-10">
 <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 flex-1 min-w-0">
 <div className="w-20 authority-title !text-2xs opacity-30 tracking-wide shrink-0">{record.time.toUpperCase()}</div>
 <div className={`text-sm tracking-tight transition-colors duration-500 ${isExpanded ? 'font-medium text-[var(--text-primary)]' : 'font-light text-[var(--text-primary)]/60'}`}>
 {record.title}
 </div>
 </div>
 
 <div className="flex items-center gap-6">
 <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border shadow-sm transition-all duration-500 ${
 record.status === 'active' ? 'bg-rose-500/10 border-rose-500/20' : 
 record.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20' : 
 'bg-emerald-500/10 border-emerald-500/20'
 }`}>
 <motion.div 
 animate={record.status === 'active' ? { scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] } : {}}
 transition={{ repeat: Infinity, duration: 2 }}
 className={`w-1.5 h-1.5 rounded-full ${
 record.status === 'active' ? 'bg-rose-500 shadow-[0_0_8px_rgb(244,63,94)]' : 
 record.status === 'pending' ? 'bg-amber-500 shadow-[0_0_8px_rgb(245,158,11)]' : 
 'bg-emerald-500 shadow-[0_0_8px_rgb(16,185,129)]'
 }`} />
 <span className={`authority-title !text-2xs relative z-10 transition-all duration-700 font-bold tracking-wide ${isExpanded ? 'opacity-100 font-black' : 'opacity-30 font-medium group-hover:font-bold'} ${
 record.status === 'active' ? 'text-rose-500' : 
 record.status === 'pending' ? 'text-amber-500' : 
 'text-emerald-500'
 }`}>{record.status === 'active' ? 'UYARI' : record.status === 'pending' ? 'BEKLEYEN' : 'ÇÖZÜLDÜ'}</span>
 </div>
 
 <motion.div
 animate={{ rotate: isExpanded ? 90 : 0 }}
 className="text-[var(--text-primary)]/20 group-hover:text-[var(--text-primary)]/40 transition-colors"
 >
 <ChevronRight size={18} />
 </motion.div>
 </div>
 </motion.div>

 <AnimatePresence>
 {isExpanded && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="overflow-hidden"
 >
 <div className="pt-10 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-10">
 <div className="flex flex-col gap-3">
 <span className="authority-title !text-2xs opacity-30 tracking-wide">KAYIT KİMLİĞİ</span>
 <span className="text-[var(--text-primary)] font-mono text-xs tracking-wide opacity-80">#{record.id.substring(0, 10).toUpperCase()}</span>
 </div>
 <div className="flex flex-col gap-3">
 <span className="authority-title !text-2xs opacity-30 tracking-wide">KATEGORİZASYON</span>
 <span className={`text-xs font-medium uppercase tracking-wide ${record.type === 'alarm' ? 'text-rose-500' : 'text-[var(--dynamic-aura,var(--aura-indigo))]'}`}>
 {record.type === 'alarm' ? 'Nöbet Uyarısı' : 'İzin Talebi'}
 </span>
 </div>
 <div className="flex flex-col gap-3 col-span-2">
 <span className="authority-title !text-2xs opacity-30 tracking-wide">HIZLI İŞLEMLER</span>
 <div className="flex flex-wrap gap-3">
 {record.type === 'izin' && record.status === 'pending' ? (
 <>
 <motion.button
 whileHover={{ y: -2, backgroundColor: 'rgba(16,185,129,0.15)' }}
 whileTap={{ scale: 0.98 }}
 disabled={processingId === record.id}
 onClick={(e) => {
 e.stopPropagation();
 if (record.baslangic && record.bitis) {
 const engelMesaji = izinOnayCumaEngelMesaji({ baslangic: record.baslangic, bitis: record.bitis });
 if (engelMesaji) {
 showNotification('Onaylanamaz', engelMesaji, 'warning');
 return;
 }
 }
 setDecisionConfirm({ open: true, id: record.id, durum: 'onaylandi', title: record.title });
 }}
 className="px-6 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-2xs uppercase tracking-wide font-bold flex items-center gap-3 shadow-lg disabled:opacity-40 disabled:cursor-wait"
 >
 <Check size={14} strokeWidth={3} /> ONAYLA
 </motion.button>
 <motion.button
 whileHover={{ y: -2, backgroundColor: 'rgba(244,63,94,0.15)' }}
 whileTap={{ scale: 0.98 }}
 disabled={processingId === record.id}
 onClick={(e) => { e.stopPropagation(); setDecisionConfirm({ open: true, id: record.id, durum: 'reddedildi', title: record.title }); }}
 className="px-6 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-2xs uppercase tracking-wide font-bold flex items-center gap-3 shadow-lg disabled:opacity-40 disabled:cursor-wait"
 >
 <X size={14} strokeWidth={3} /> REDDET
 </motion.button>
 </>
 ) : (
 <motion.button 
 whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.05)' }}
 whileTap={{ scale: 0.98 }}
 onClick={(e) => {
  e.stopPropagation();
  if (record.type === 'alarm') {
   onOpenDrawer('alarmlar');
  } else {
   setActiveTab('ekip', 'mazeretler');
  }
 }}
 className="px-6 py-2.5 rounded-2xl bg-[var(--text-primary)]/5 border border-[var(--text-primary)]/10 text-[var(--text-primary)] text-2xs uppercase tracking-wide font-bold shadow-lg"
 >
 DETAYLARI İNCELE
 </motion.button>
 )}
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
 })
 ) : (
 <div className="spatial-glass !rounded-card p-16 text-center flex flex-col items-center gap-4 relative overflow-hidden">
 <div className="w-14 h-14 rounded-[24px] bg-[var(--text-primary)]/[0.03] border border-[var(--text-primary)]/[0.06] flex items-center justify-center animate-float">
 <Activity size={24} strokeWidth={1} className="text-[var(--text-secondary)]" />
 </div>
 <p className="authority-title !text-2xs opacity-20 tracking-wide">ŞU AN AKTİF BİR HİZMET KAYDI BULUNMUYOR</p>
 </div>
 )}
 </AnimatePresence>
 </div>
 </motion.div>

 <ConfirmModal
 isOpen={decisionConfirm.open}
 onClose={() => setDecisionConfirm({ open: false, id: null, durum: null, title: '' })}
 onConfirm={() => {
 if (decisionConfirm.id && decisionConfirm.durum) {
 kararVer(decisionConfirm.id, decisionConfirm.durum, decisionConfirm.title);
 }
 setDecisionConfirm({ open: false, id: null, durum: null, title: '' });
 }}
 title={decisionConfirm.durum === 'onaylandi' ? 'İZNİ ONAYLA' : 'İZNİ REDDET'}
 message={`${decisionConfirm.title}${decisionConfirm.durum === 'onaylandi' ? ' onaylanacak' : ' reddedilecek'}. Bu kararı daha sonra geri alabilirsiniz.`}
 confirmText={decisionConfirm.durum === 'onaylandi' ? 'EVET, ONAYLA' : 'EVET, REDDET'}
 isDanger={decisionConfirm.durum === 'reddedildi'}
 />
 </div>
 );
}
