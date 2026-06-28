import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, CalendarClock, Activity, ChevronRight, Check, X, Megaphone } from 'lucide-react';
import { useKrizAlarmlari } from '../../../hooks/admin/useKrizAlarmlari';
import { useAdminIzinler } from '../../../hooks/admin/useAdminIzinler';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { LiveClock } from '../../../components/LiveClock';





interface HeroScreenProps {
 muezzinlerSayisi: number;
 cozulmamisSayisi: number;
 pendingIzinler: number;
 setActiveTab: (tab: string, subtab?: string) => void;
 onOpenDrawer: (content: 'alarmlar' | 'duyurular' | null) => void;
}


export default function ExecutiveHeroScreen({
 muezzinlerSayisi,
 cozulmamisSayisi,
 pendingIzinler,
 setActiveTab,
 onOpenDrawer
}: HeroScreenProps) {
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const { alarmlar } = useKrizAlarmlari();
 const { izinler, izinGuncelle } = useAdminIzinler();

 const combinedOperations = [
 ...alarmlar.slice(0, 5).map(a => ({
 id: a.id,
 title: a.mesaj,
 status: a.cozuldu ? 'completed' : 'active',
 time: a.olusturmaTarihi ? formatDistanceToNow(a.olusturmaTarihi.toDate(), { addSuffix: true, locale: tr }) : 'Az önce',
 priority: 'high',
 type: 'alarm'
 })),
 ...izinler.filter(i => i.durum === 'onay_bekliyor').slice(0, 5).map(i => ({
 id: i.id,
 title: `${i.displayName} - İzin Talebi`,
 status: 'pending',
 time: i.olusturmaTarihi ? formatDistanceToNow(i.olusturmaTarihi.toDate(), { addSuffix: true, locale: tr }) : 'Az önce',
 priority: 'medium',
 type: 'izin',
 originalData: i
 }))
 ].sort((a, b) => {
 // Alarms have higher weight than permissions
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
 <span className="authority-title !text-[8px] !text-emerald-500 font-medium">CANLI SİSTEM DURUMU</span>
 </div>
 <h1 className="text-3xl lg:text-5xl font-light text-[var(--text-primary)] tracking-tight leading-none max-w-2xl group-hover:font-medium transition-all duration-1000">
 Yönetim <span className="text-[var(--dynamic-aura,var(--aura-indigo))] italic">Senkronize</span> ve <span className="font-normal group-hover:font-bold transition-all duration-1000">Aktif.</span>
 </h1>
 </div>
 
 <div className="flex items-center gap-10 px-8 py-4 spatial-glass border border-[var(--glass-border)]">
 <div className="flex flex-col items-end">
 <LiveClock className="text-2xl font-light text-[var(--text-primary)] tracking-tighter leading-none" />
 <span className="authority-title !text-[7px] opacity-30 mt-2">YEREL ZAMAN</span>
 </div>
 </div>
 </motion.header>

 {/* BENTO GRID: Immersive Layout */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
 
 {/* Large Tile: Operasyonel Durum */}
 <motion.div
 whileHover={{ y: -5, scale: 1.005 }}
 whileTap={{ scale: 0.995 }}
 transition={{ type: 'spring', stiffness: 280, damping: 22 }}
 onClick={() => setActiveTab('ekip')}
 className="col-span-1 md:col-span-1 lg:col-span-7 spatial-glass p-8 relative overflow-hidden group min-h-[300px] flex flex-col justify-between cursor-pointer shimmer-trigger"
 >
  <div className="kinetic-sheen" />
  <div className="absolute inset-0 bg-gradient-to-b from-[var(--text-primary)]/[0.02] via-transparent to-transparent pointer-events-none" />

  {/* Header */}
  <div className="relative z-10 flex items-center justify-between mb-6">
  <div className="w-12 h-12 rounded-2xl bg-[var(--dynamic-aura,var(--aura-indigo))]/10 flex items-center justify-center text-[var(--dynamic-aura,var(--aura-indigo))] border border-[var(--dynamic-aura,var(--aura-indigo))]/20 shadow-lg">
  <Activity size={24} strokeWidth={1.5} />
  </div>
  <span className="authority-title !text-[8px] opacity-40 font-medium tracking-wide group-hover:font-bold transition-all duration-700">OPERASYONEL KAPASİTE</span>
  </div>

  {/* Personnel Count — large number */}
  <div className="relative z-10 flex-1 flex flex-col justify-center">
  <div className="text-6xl lg:text-8xl font-extralight text-[var(--text-primary)] tracking-tighter leading-none tabular-nums mb-2">
  {muezzinlerSayisi}
  </div>
  <span className="authority-title !text-[7px] opacity-25 tracking-widest">TOPLAM AKTİF PERSONEL</span>

  {/* Status bars */}
  <div className="mt-8 flex flex-col gap-3">
  <div className="flex items-center gap-4">
  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
  <div className="flex-1 h-[2px] rounded-full bg-[var(--glass-border)] overflow-hidden">
  <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: '100%' }} />
  </div>
  <span className="authority-title !text-[7px] opacity-30 w-16 text-right">AKTİF</span>
  </div>
  <div className="flex items-center gap-4">
  <div className={`w-2 h-2 rounded-full ${cozulmamisSayisi > 0 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-[var(--glass-border)]'}`} />
  <div className="flex-1 h-[2px] rounded-full bg-[var(--glass-border)] overflow-hidden">
  <div className={`h-full rounded-full transition-all duration-1000 ${cozulmamisSayisi > 0 ? 'bg-rose-500/60' : 'bg-[var(--glass-border)]'}`}
  style={{ width: cozulmamisSayisi > 0 ? `${Math.min((cozulmamisSayisi / muezzinlerSayisi) * 100, 100)}%` : '0%' }} />
  </div>
  <span className="authority-title !text-[7px] opacity-30 w-16 text-right">ALARM</span>
  </div>
  <div className="flex items-center gap-4">
  <div className={`w-2 h-2 rounded-full ${pendingIzinler > 0 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-[var(--glass-border)]'}`} />
  <div className="flex-1 h-[2px] rounded-full bg-[var(--glass-border)] overflow-hidden">
  <div className={`h-full rounded-full transition-all duration-1000 ${pendingIzinler > 0 ? 'bg-amber-500/60' : 'bg-[var(--glass-border)]'}`}
  style={{ width: pendingIzinler > 0 ? `${Math.min((pendingIzinler / muezzinlerSayisi) * 100, 100)}%` : '0%' }} />
  </div>
  <span className="authority-title !text-[7px] opacity-30 w-16 text-right">BEKLEYEN</span>
  </div>
  </div>
  </div>

  {/* Personnel avatars */}
  <div className="relative z-10 flex items-center gap-6 mt-6 pt-4 border-t border-[var(--glass-border)]">
  <div className="flex -space-x-3">
  {Array.from({ length: Math.min(muezzinlerSayisi, 5) }).map((_, i) => (
  <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--app-bg)] bg-[var(--surface-medium)] flex items-center justify-center text-[9px] font-bold shadow-[var(--spatial-shadow)] relative overflow-hidden backdrop-blur-md">
  <div className="absolute inset-0 bg-gradient-to-br from-[var(--text-primary)]/10 to-transparent" />
  <span className="relative z-10 text-[var(--text-primary)]">{String.fromCharCode(65 + i)}</span>
  <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-[var(--app-bg)] z-20" />
  </div>
  ))}
  {muezzinlerSayisi > 5 && (
  <div className="w-8 h-8 rounded-full border-2 border-[var(--app-bg)] bg-[var(--text-primary)] text-[var(--app-bg)] flex items-center justify-center text-[9px] font-bold shadow-[var(--spatial-shadow)]">
  +{muezzinlerSayisi - 5}
  </div>
  )}
  </div>
  <p className="authority-title !text-[7px] opacity-25 font-medium tracking-wide">
  {muezzinlerSayisi} kişi senkronize
  </p>
  </div>
  </motion.div>

 {/* Side Stack */}
 <div className="col-span-1 md:col-span-1 lg:col-span-5 flex flex-col gap-8">
 {/* Kriz Tile */}
 <motion.div 
 whileHover={{ y: -4, scale: 1.01 }}
 whileTap={{ scale: 0.99 }}
 transition={{ type: 'spring', stiffness: 300, damping: 24 }}
 onClick={() => onOpenDrawer('alarmlar')}
 className={`flex-1 spatial-glass p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-700 cursor-pointer min-h-[140px] shimmer-trigger ${cozulmamisSayisi > 0 ? 'spatial-glass-elevated border-rose-500/30 bg-rose-500/[0.04]' : 'hover:bg-white/[0.02]'}`}
 >
 <div className="kinetic-sheen" />
 <div className="flex items-center justify-between relative z-10">
 <div className={`relative flex flex-col items-center justify-center gap-2.5 w-[60px] h-[60px] rounded-[24px] transition-all duration-700 group z-10 ${cozulmamisSayisi > 0 ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-[var(--surface-low)] text-[var(--text-secondary)] border border-[var(--glass-border)]'}`}>
 <ShieldAlert size={20} strokeWidth={1.5} />
 </div>
 <div className="text-right">
 <div className={`text-4xl font-light tracking-tighter leading-none ${cozulmamisSayisi > 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
 {cozulmamisSayisi}
 </div>
 <span className="authority-title !text-[7px] opacity-40 mt-2 font-medium tracking-wide">KRİZ ALARMLARI</span>
 </div>
 </div>
 {cozulmamisSayisi > 0 && (
 <div className="mt-4 pt-4 border-t border-rose-500/10 relative z-10">
 <p className="text-[8px] font-bold text-rose-400 uppercase tracking-wide truncate">
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
 className="flex-1 spatial-glass p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-700 cursor-pointer min-h-[140px] shimmer-trigger"
 >
 <div className="kinetic-sheen" />
 <div className="flex items-center justify-between">
 <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-lg flex items-center justify-center">
 <CalendarClock size={18} strokeWidth={1.5} />
 </div>
 <div className="text-right">
 <div className="text-3xl font-light text-[var(--text-primary)] tracking-tighter leading-none tabular-nums">
 {pendingIzinler}
 </div>
 <span className="authority-title !text-[7px] opacity-40 mt-2 font-medium tracking-wide">BEKLEYEN İZİN</span>
 </div>
 </div>
  <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
  <p className="text-[7px] font-bold text-amber-500/60 uppercase tracking-wide">AKTİF TALEPLER</p>
  </div>
 </motion.div>

 <motion.div
 whileHover={{ y: -4, scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 transition={{ type: 'spring', stiffness: 300, damping: 24 }}
 onClick={() => onOpenDrawer('duyurular')}
 className="flex-1 spatial-glass p-6 relative overflow-hidden flex flex-col justify-between transition-all duration-700 cursor-pointer min-h-[140px] shimmer-trigger"
 >
 <div className="kinetic-sheen" />
 <div className="flex items-center justify-between">
 <div className="w-10 h-10 rounded-2xl bg-[var(--dynamic-aura,var(--aura-indigo))]/10 text-[var(--dynamic-aura,var(--aura-indigo))] border border-[var(--dynamic-aura,var(--aura-indigo))]/20 shadow-lg flex items-center justify-center">
 <Megaphone size={18} strokeWidth={1.5} />
 </div>
 <div className="text-right">
 <div className="text-3xl font-light text-[var(--text-primary)]/20 tracking-tighter leading-none italic">
 —
 </div>
 <span className="authority-title !text-[7px] opacity-40 mt-2 font-medium tracking-wide">DUYURU</span>
 </div>
 </div>
  <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
  <p className="text-[7px] font-bold text-[var(--dynamic-aura,var(--aura-indigo))]/60 uppercase tracking-wide">MESAJ YAYINLA</p>
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
 <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)] uppercase tracking-[0.1em]">Canlı Akış</h2>
 </div>
  <button
  onClick={() => setActiveTab('ekip')}
  className="authority-title !text-[8px] !text-[var(--dynamic-aura,var(--aura-indigo))] cursor-pointer hover:text-[var(--text-primary)] transition-all flex items-center gap-2 group tracking-wide font-medium"
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
 className={`spatial-glass p-5 cursor-pointer group transition-all duration-500 relative overflow-hidden ${isExpanded ? 'spatial-glass-elevated border-[var(--dynamic-aura,var(--aura-indigo))]/30' : 'hover:bg-white/[0.02]'}`}
 >
 {/* Item Sheen */}
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

 <motion.div layout className="flex items-center justify-between relative z-10">
 <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 flex-1 min-w-0">
 <div className="w-20 authority-title !text-[7px] opacity-30 tracking-wide shrink-0">{record.time.toUpperCase()}</div>
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
 <span className={`authority-title !text-[6px] relative z-10 transition-all duration-700 font-bold tracking-wide ${isExpanded ? 'opacity-100 font-black' : 'opacity-30 font-medium group-hover:font-bold'} ${
 record.status === 'active' ? 'text-rose-500' : 
 record.status === 'pending' ? 'text-amber-500' : 
 'text-emerald-500'
 }`}>{record.status === 'active' ? 'KRİTİK' : record.status === 'pending' ? 'BEKLEYEN' : 'ÇÖZÜLDÜ'}</span>
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
 <span className="authority-title !text-[7px] opacity-30 tracking-wide">KAYIT KİMLİĞİ</span>
 <span className="text-[var(--text-primary)] font-mono text-xs tracking-wide opacity-80">#{record.id.substring(0, 10).toUpperCase()}</span>
 </div>
 <div className="flex flex-col gap-3">
 <span className="authority-title !text-[7px] opacity-30 tracking-wide">KATEGORİZASYON</span>
 <span className={`text-xs font-medium uppercase tracking-[0.1em] ${record.type === 'alarm' ? 'text-rose-500' : 'text-[var(--dynamic-aura,var(--aura-indigo))]'}`}>
 {record.type === 'alarm' ? 'Sistem Alarmı' : 'Personel Talebi'}
 </span>
 </div>
 <div className="flex flex-col gap-3 col-span-2">
 <span className="authority-title !text-[7px] opacity-30 tracking-wide">HIZLI OPERASYONLAR</span>
 <div className="flex flex-wrap gap-3">
 {record.type === 'izin' && record.status === 'pending' ? (
 <>
 <motion.button 
 whileHover={{ y: -2, backgroundColor: 'rgba(16,185,129,0.15)' }}
 whileTap={{ scale: 0.98 }}
 onClick={(e) => { e.stopPropagation(); izinGuncelle(record.id, 'onaylandi'); }}
 className="px-6 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[9px] uppercase tracking-wide font-bold flex items-center gap-3 shadow-lg"
 >
 <Check size={14} strokeWidth={3} /> ONAYLA
 </motion.button>
 <motion.button 
 whileHover={{ y: -2, backgroundColor: 'rgba(244,63,94,0.15)' }}
 whileTap={{ scale: 0.98 }}
 onClick={(e) => { e.stopPropagation(); izinGuncelle(record.id, 'reddedildi'); }}
 className="px-6 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[9px] uppercase tracking-wide font-bold flex items-center gap-3 shadow-lg"
 >
 <X size={14} strokeWidth={3} /> REDDET
 </motion.button>
 </>
 ) : (
 <motion.button 
 whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.05)' }}
 whileTap={{ scale: 0.98 }}
 onClick={(e) => { e.stopPropagation(); }}
 className="px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[var(--text-primary)] text-[9px] uppercase tracking-wide font-bold shadow-lg"
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
 <div className="spatial-glass p-16 text-center flex flex-col items-center gap-4 relative overflow-hidden">
 <div className="w-14 h-14 rounded-[24px] bg-white/[0.03] border border-white/[0.06] flex items-center justify-center animate-float">
 <Activity size={24} strokeWidth={1} className="text-white/15" />
 </div>
 <p className="authority-title !text-[8px] opacity-20 tracking-wide">ŞU AN AKTİF BİR OPERASYONEL KAYIT BULUNMUYOR</p>
 </div>
 )}
 </AnimatePresence>
 </div>
 </motion.div>
 </div>
 );
}
