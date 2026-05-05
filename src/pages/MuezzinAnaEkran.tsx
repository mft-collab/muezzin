import { LiveClock } from '../components/LiveClock';
import { useBugunkuGorevlerim } from '../hooks/useBugunkuGorevlerim';
import { useEzanVakitleri } from '../hooks/useEzanVakitleri';
import { useSonrakiVakit } from '../hooks/useSonrakiVakit';
import { useMevcutVakit } from '../hooks/useMevcutVakit';
import { HademelerListesi } from '../components/HademelerListesi';
import { KisiselGorevAkisi } from '../components/KisiselGorevAkisi';
import { GeriSayim } from '../components/GeriSayim';
import { useHaftaPlan } from '../hooks/useHaftaPlan';
import { useMuezzinler } from '../hooks/admin/useMuezzinler';
import { useAktifIzinler } from '../hooks/useAktifIzinler';
import { useDuyurular } from '../hooks/useDuyurular';
import { auth } from '../lib/firebase';
import { getTurkeyDateString, VAKIT_GORA_ISIMLERI, toTurkishUpperCase, getTurkeyNow } from '../lib/dateUtils';
import { getVakitTheme, getDynamicTheme } from '../lib/themeUtils';
import { format, startOfWeek, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Clock, Star, CheckCircle2, Megaphone, X, AlertCircle, Info, Bell, Calendar, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useRef, useMemo } from 'react';
import { Duyuru } from '../hooks/useDuyurular';
import { Link } from 'react-router-dom';

export default function MuezzinAnaEkran() {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // 3D Mouse Efektleri Apple benzeri temiz bir deneyim için kaldırıldı.

  const { gorevler, loading: gorevLoading } = useBugunkuGorevlerim();
  const { bugunVakitler, yarinVakitler, loading: vakitLoading } = useEzanVakitleri();
  const sonraki = useSonrakiVakit(bugunVakitler, yarinVakitler);
  const mevcutVakit = useMevcutVakit(bugunVakitler);

  const dynamicTheme = useMemo(() => getDynamicTheme(sonraki?.vakit), [sonraki?.vakit]);

  const bugunStr = getTurkeyDateString();
  const bugunDate = parseISO(bugunStr);
  const haftaBaslangic = startOfWeek(bugunDate, { weekStartsOn: 1 });
  const haftaId = `W${format(haftaBaslangic, 'yyyy-MM-dd')}`;
  
  const { plan } = useHaftaPlan(haftaId);
  const { muezzinler } = useMuezzinler();
  const { aktifIzinler } = useAktifIzinler();
  const { duyurular } = useDuyurular(1);
  const [viewingDuyuru, setViewingDuyuru] = useState<Duyuru | null>(null);
  const currentUser = auth.currentUser;

  const getMuezzinName = (uid: string | undefined) => {
    if (!uid) return '';
    if (uid === 'SISTEM') return 'Sistem';
    return muezzinler.find(m => m.id === uid)?.displayName || 'Bilinmiyor';
  };

  const vakitKeyForPlan = mevcutVakit || sonraki?.vakit || 'sabah';
  const bugunPlan = plan?.gunler?.[bugunStr]?.[vakitKeyForPlan];

  const asilIzinde = useMemo(() => {
    if (!bugunPlan?.asil) return false;
    return aktifIzinler.some(izin => izin.uid === bugunPlan.asil);
  }, [bugunPlan?.asil, aktifIzinler]);

  const yedekIzinde = useMemo(() => {
    if (!bugunPlan?.yedek) return false;
    return aktifIzinler.some(izin => izin.uid === bugunPlan.yedek);
  }, [bugunPlan?.yedek, aktifIzinler]);

  const asilSabitIzinde = useMemo(() => {
    if (!bugunPlan?.asil) return false;
    const m = muezzinler.find(u => u.id === bugunPlan.asil);
    if (!m?.haftalikIzinGunu) return false;
    const today = getTurkeyNow().getDay();
    const normalizedToday = today === 0 ? 7 : today;
    return m.haftalikIzinGunu === normalizedToday;
  }, [bugunPlan?.asil, muezzinler]);

  const yedekSabitIzinde = useMemo(() => {
    if (!bugunPlan?.yedek) return false;
    const m = muezzinler.find(u => u.id === bugunPlan.yedek);
    if (!m?.haftalikIzinGunu) return false;
    const today = getTurkeyNow().getDay();
    const normalizedToday = today === 0 ? 7 : today;
    return m.haftalikIzinGunu === normalizedToday;
  }, [bugunPlan?.yedek, muezzinler]);

  const isGeceModu = useMemo(() => {
    if (mevcutVakit !== 'yatsi' || sonraki?.vakit !== 'sabah' || !bugunVakitler) return false;
    
    const simdi = new Date();
    const [yS, yD] = bugunVakitler.yatsi.split(':').map(Number);
    const yatsiZamani = new Date();
    yatsiZamani.setHours(yS, yD, 0, 0);

    // Eğer gece yarısını geçtiysek (00:00 - 04:00 arası gibi), her türlü gece modundayız
    if (simdi.getHours() < 5 && simdi.getHours() >= 0) return true;

    // Yatsı ezanından 120 dakika (2 saat) sonra gece moduna geç
    const geceModuBaslangic = new Date(yatsiZamani.getTime() + 120 * 60 * 1000);
    return simdi >= geceModuBaslangic;
  }, [mevcutVakit, sonraki?.vakit, bugunVakitler]);

  const theme = isGeceModu ? getVakitTheme('yatsi') : (mevcutVakit ? getVakitTheme(mevcutVakit) : getVakitTheme('default'));
  const isLoading = gorevLoading || vakitLoading;

  return (
    <div className="w-full max-w-7xl mx-auto px-0 md:px-8 lg:px-10 pb-32 safe-area-bottom">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-16 items-start">
        
        {/* LEFT COLUMN: Hero Section */}
        <div className="lg:col-span-5 flex flex-col lg:sticky lg:top-8 transition-all duration-500">
          <AnimatePresence mode="wait">
            {isLoading ? (
               <motion.div 
                 key="ultra-premium-loading"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="w-full aspect-[4/5] lg:aspect-auto lg:h-[85vh] bg-white rounded-none sm:rounded-[60px] border-x-0 sm:border border-blue-50 flex flex-col items-center justify-center shadow-lg relative overflow-hidden"
               >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 to-transparent" />
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="relative w-20 h-20 mb-10">
                       <div className="absolute inset-0 rounded-full border border-blue-100 animate-[ping_3s_linear_infinite]" />
                       <div className="absolute inset-4 rounded-full border border-blue-200 animate-[ping_3s_linear_infinite_1s]" />
                       <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                       </div>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                    >
                      <p className="text-[10px] font-bold uppercase text-blue-900/40 tracking-[0.3em]">HİKMET BAĞLANTISI AKTİF</p>
                    </motion.div>
                  </div>
               </motion.div>
            ) : !isGeceModu && sonraki ? (
              <div className="h-screen lg:h-auto min-h-[100dvh] lg:min-h-[85vh] flex flex-col">
                <motion.div 
                   ref={cardRef}
                   key={sonraki.vakit}
                   initial={{ opacity: 0, scale: 0.98 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 1.02 }}
                   className={`relative ${theme.bg} rounded-none sm:rounded-[40px] p-6 xs:p-8 sm:p-10 pb-28 sm:pb-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden flex-1 flex flex-col justify-between items-center transition-all duration-1000`}
                >
                  <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/[0.08] rounded-full blur-[100px] pointer-events-none mix-blend-overlay" />
                  <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-black/[0.1] rounded-full blur-[120px] pointer-events-none" />
                  
                  {/* Dynamic Glowing Aura */}
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] rounded-full blur-[120px] pointer-events-none opacity-20 transition-all duration-1000"
                    style={{ background: `radial-gradient(circle, ${dynamicTheme.color}, transparent 60%)` }}
                  />
                  <div className="absolute inset-0 border border-white/5 rounded-none sm:rounded-[60px] z-50 pointer-events-none opacity-50" />
                  
                  {/* İslami Geometrik Patern */}
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
                    style={{ 
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill='none' stroke='white' stroke-width='0.5'%3E%3Cpath d='M50 5L61.23 38.77H95L66.88 59.23L78.11 93L50 72.54L21.89 93L33.12 59.23L5 38.77H38.77L50 5Z'/%3E%3Ccircle cx='50' cy='50' r='45'/%3E%3Cpath d='M5 50L50 5L95 50L50 95L5 50Z'/%3E%3C/g%3E%3C/svg%3E")`,
                      backgroundSize: '80px 80px'
                    }} 
                  />

                  {/* Header in Hero */}
                  <div className="w-full flex justify-between items-start z-20 mt-4 sm:mt-0">
                    <div className="flex flex-col gap-1">
                      <span className="text-white/90 font-medium text-[10px] uppercase tracking-widest">{format(bugunDate, 'EEEE', { locale: tr })}</span>
                      <span className="text-white/70 text-[9px] uppercase tracking-wider">{format(bugunDate, 'd MMMM yyyy', { locale: tr })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="text-white">
                          <LiveClock />
                       </div>
                    </div>
                  </div>
                  
                  {/* Center Content */}
                  <div className="relative flex flex-col items-center text-center w-full z-20 flex-1 justify-center" style={{ transform: "translateZ(100px)" }}>
                    <motion.div initial={{ opacity: 0, tracking: '0.5em' }} animate={{ opacity: 1, tracking: '0.2em' }} transition={{ delay: 0.5, duration: 1 }} className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
                      <div className="h-px w-8 sm:w-12 bg-white/20" />
                      <span className="text-white/70 font-medium text-[8px] sm:text-[10px] uppercase drop-shadow-md tracking-widest">{theme.text}</span>
                      <div className="h-px w-8 sm:w-12 bg-white/20" />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="relative inline-block mb-8 sm:mb-10 text-center">
                      <h2 className="text-6xl xs:text-7xl sm:text-[90px] lg:text-[110px] font-sans font-thin text-white tracking-tighter leading-none" style={{ textShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
                        {mevcutVakit ? toTurkishUpperCase(VAKIT_GORA_ISIMLERI[mevcutVakit]) : '...'}
                      </h2>
                      <div 
                        className="mt-4 sm:mt-6 inline-block backdrop-blur-xl border px-6 py-2 rounded-full text-[9px] font-medium tracking-widest uppercase transition-all duration-700"
                        style={{ backgroundColor: `${dynamicTheme.color}15`, borderColor: `${dynamicTheme.color}40`, color: dynamicTheme.color }}
                      >
                         {mevcutVakit ? `${toTurkishUpperCase(VAKIT_GORA_ISIMLERI[mevcutVakit])} VAKTİNDESİNİZ` : 'HİZMET VAKTİ İCRADA'}
                      </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 20 }} className="relative inline-flex justify-center items-center">
                      <div className="relative z-10">
                        <GeriSayim 
                          ezanSaati={sonraki.ezanSaati} 
                          baslangicZamani={sonraki.baslangicZamani} 
                          sonrakiVakit={sonraki.vakit}
                        />
                      </div>
                    </motion.div>
                  </div>

                  {/* Vakitler Row Inside Hero */}
                  <div className="w-full z-20 mt-10 mb-4 sm:mb-0">
                     <div className="grid grid-cols-5 gap-2 sm:gap-4 w-full">
                        {bugunVakitler && Object.entries(VAKIT_GORA_ISIMLERI)
                          .filter(([key]) => key !== 'imsak' && key !== 'gunes')
                          .map(([vakitKey, vakitIsim]) => {
                            const isNext = sonraki?.vakit === vakitKey;
                            
                            return (
                               <motion.div 
                                 key={vakitKey} 
                                 whileHover={{ y: -4, scale: 1.02 }}
                                 animate={isNext ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
                                 className={`aspect-square rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all duration-700 relative overflow-hidden ${
                                   isNext 
                                     ? 'bg-white shadow-2xl shadow-black/30' 
                                     : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/15'
                                 }`}
                                 style={isNext ? { color: dynamicTheme.color } : {}}
                               >
                                 <span className={`text-[7px] sm:text-[9px] font-medium uppercase tracking-[0.15em] mb-1 sm:mb-1.5 block w-full text-center transition-colors ${isNext ? '' : 'text-white/40'}`} style={isNext ? { color: `${dynamicTheme.color}80` } : {}}>{vakitIsim.replace('Namazı', '').trim()}</span>
                                 <span className={`text-sm sm:text-lg font-sans font-medium tracking-tight ${isNext ? 'text-slate-900' : 'text-white/90'}`}>
                                    {bugunVakitler[vakitKey as keyof typeof bugunVakitler]}
                                 </span>
                               </motion.div>
                            );
                        })}
                     </div>
                  </div>

                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/10 to-transparent opacity-30 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tl from-white/10 to-transparent opacity-30 pointer-events-none" />
                </motion.div>
              </div>
            ) : (
                <motion.div 
                   ref={cardRef}
                   key="night-mode-card"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="relative bg-slate-950 rounded-none sm:rounded-[48px] p-6 xs:p-8 sm:p-10 pb-28 sm:pb-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex-1 lg:h-[85vh] flex flex-col justify-between items-center text-center"
                >
                 <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-black pointer-events-none" />
                 
                 <div className="relative z-10 flex flex-col justify-between h-full w-full">
                    {/* Header */}
                    <div className="w-full flex justify-between items-start z-20">
                      <div className="flex flex-col gap-1 text-left">
                        <span className="text-white/90 font-medium text-[10px] uppercase tracking-widest">{format(bugunDate, 'EEEE', { locale: tr })}</span>
                        <span className="text-white/70 text-[9px] uppercase tracking-wider">{format(bugunDate, 'd MMMM yyyy', { locale: tr })}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="text-white">
                            <LiveClock />
                         </div>
                      </div>
                    </div>

                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="mt-20 sm:mt-0">
                      <Star size={64} className="mb-10 opacity-70 mx-auto transition-colors duration-700" style={{ color: dynamicTheme.color }} strokeWidth={0.5} />
                    </motion.div>
                    <h2 className="text-5xl sm:text-6xl font-sans font-thin text-white mb-8 tracking-tighter" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>Hayırlı ve Huzurlu Geceler</h2>
                    <p className="text-[10px] font-medium uppercase tracking-widest max-w-xs mx-auto mb-16 border-y border-white/10 py-3 w-full" style={{ color: `${dynamicTheme.color}80`, borderColor: `${dynamicTheme.color}20` }}>İstirahat ve Teheccüd İklimi</p>
                    <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="px-10 py-8 bg-white/[0.06] backdrop-blur-xl rounded-[32px] border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group/tile w-full max-w-sm">
                       <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover/tile:opacity-100 transition-opacity duration-700" style={{ backgroundImage: `linear-gradient(to bottom right, ${dynamicTheme.color}20, transparent)` }} />
                       <p className="text-[10px] font-medium text-white/60 uppercase tracking-widest mb-3 relative z-10">Sabah Şerifine Hazırlık</p>
                       <p className="text-xl font-sans font-extralight text-white relative z-10 tracking-tight">Sabah Namazı İklimi</p>
                    </motion.div>

                    {/* Vakitler Row Inside Night Mode As Well */}
                    <div className="w-full z-20 mt-16 sm:mt-24 mb-4 sm:mb-0">
                       <div className="grid grid-cols-5 gap-2 sm:gap-3 w-full">
                          {bugunVakitler && Object.entries(VAKIT_GORA_ISIMLERI)
                            .filter(([key]) => key !== 'imsak' && key !== 'gunes')
                            .map(([vakitKey, vakitIsim]) => {
                              const isNext = sonraki?.vakit === vakitKey;
                              
                              return (
                                 <motion.div 
                                   key={vakitKey} 
                                   whileHover={{ y: -4, scale: 1.02 }}
                                   animate={isNext ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
                                   className={`aspect-[0.85/1] rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center transition-all duration-700 relative overflow-hidden ${
                                     isNext 
                                       ? 'bg-white shadow-2xl shadow-black/30' 
                                       : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/15'
                                   }`}
                                   style={isNext ? { color: dynamicTheme.color } : {}}
                                 >
                                   <span className={`text-[7px] sm:text-[10px] font-black uppercase tracking-[0.15em] mb-1 sm:mb-2 block w-full text-center transition-colors ${isNext ? '' : 'text-white/40'}`} style={isNext ? { color: `${dynamicTheme.color}80` } : {}}>{vakitIsim.replace('Namazı', '').trim()}</span>
                                   <span className={`text-sm sm:text-xl font-sans font-black tracking-tighter ${isNext ? 'text-slate-900' : 'text-white/90'}`}>
                                      {bugunVakitler[vakitKey as keyof typeof bugunVakitler]}
                                   </span>
                                 </motion.div>
                              );
                          })}
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: Extracted Components */}
        <div className="lg:col-span-7 flex flex-col gap-16 lg:pt-6 px-4 md:px-0">
          {duyurular.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setViewingDuyuru(duyurular[0])}
              className="rounded-3xl p-[1px] shadow-xl overflow-hidden relative -mt-4 mb-4 cursor-pointer group active:scale-[0.98] transition-all"
              style={{ backgroundColor: `${dynamicTheme.color}40`, boxShadow: `0 10px 40px -10px ${dynamicTheme.color}30` }}
            >
              <div className="flex items-center gap-3 px-5 py-4 bg-white rounded-[23px] group-hover:bg-slate-50 transition-colors">
                <div className="p-2.5 rounded-xl transition-colors" style={{ backgroundColor: `${dynamicTheme.color}15`, color: dynamicTheme.color }}>
                  <Megaphone size={16} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none">Kurumsal Duyuru</p>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">İncele</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate uppercase tracking-tight italic">{duyurular[0].baslik}</p>
                </div>
              </div>
            </motion.div>
          )}
          <HademelerListesi 
            asilIsim={getMuezzinName(bugunPlan?.asil)} 
            yedekIsim={getMuezzinName(bugunPlan?.yedek)} 
            planVarMi={!!bugunPlan} 
            isAsilSizMisiniz={currentUser?.uid === bugunPlan?.asil}
            isYedekSizMisiniz={currentUser?.uid === bugunPlan?.yedek}
            asilIzinde={asilIzinde}
            yedekIzinde={yedekIzinde}
            asilSabitIzinde={asilSabitIzinde}
            yedekSabitIzinde={yedekSabitIzinde}
          />
          
          <KisiselGorevAkisi 
            loading={gorevLoading} 
            gorevler={gorevler} 
            bugunVakitler={bugunVakitler} 
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="px-4 md:px-0"
          >
            <Link 
              to="/takvim"
              className="group relative flex items-center justify-between p-8 bg-white/80 backdrop-blur-xl rounded-[40px] border border-blue-950/5 shadow-[0_4px_24px_rgba(30,58,138,0.04)] hover:shadow-[0_12px_40px_rgba(30,58,138,0.08)] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 rounded-[24px] bg-blue-950 text-white flex items-center justify-center shadow-lg shadow-blue-950/20 group-hover:scale-110 transition-transform duration-500">
                  <Calendar size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Haftalık Görev Çizelgesi</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Personel Dağılımını İnceleyin</p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-950 group-hover:text-white transition-all duration-500 relative z-10">
                <ChevronRight size={20} />
              </div>
            </Link>
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {viewingDuyuru && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setViewingDuyuru(null)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, rotateX: 20, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, rotateX: 0, scale: 1, y: 0 }} 
              exit={{ opacity: 0, rotateX: -20, scale: 0.9, y: 20 }} 
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className={`h-24 flex items-end px-8 pb-6 ${
                viewingDuyuru.tip === 'onemli' ? 'bg-gradient-to-br from-rose-500 to-rose-600' :
                viewingDuyuru.tip === 'bilgi' ? 'bg-gradient-to-br from-sky-500 to-sky-600' : 
                'bg-gradient-to-br from-indigo-500 to-indigo-600'
              }`}>
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md border border-white/20">
                      {viewingDuyuru.tip === 'onemli' ? <AlertCircle size={20} className="text-white" /> :
                       viewingDuyuru.tip === 'bilgi' ? <Info size={20} className="text-white" /> : 
                       <Bell size={20} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] leading-none mb-1">Kurumsal Duyuru</p>
                      <p className="text-xs font-bold text-white uppercase tracking-wider">{viewingDuyuru.tip}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setViewingDuyuru(null)}
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-md border border-white/10 transition-all active:scale-95"
                  >
                    <X size={20} className="text-white" />
                  </button>
                </div>
              </div>

              <div className="p-8 sm:p-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4 leading-tight">
                  {viewingDuyuru.baslik}
                </h3>
                <div className="h-px w-12 bg-slate-100 mb-6" />
                <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap mb-8">
                  {viewingDuyuru.icerik}
                </p>
                
                <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      ID
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Yayın Tarihi</span>
                      <span className="text-[11px] font-bold text-slate-600">
                        {viewingDuyuru.tarih 
                          ? format(
                              typeof viewingDuyuru.tarih?.toDate === 'function' ? viewingDuyuru.tarih.toDate() : new Date(viewingDuyuru.tarih?.seconds ? viewingDuyuru.tarih.seconds * 1000 : viewingDuyuru.tarih), 
                              'd MMMM yyyy HH:mm', 
                              { locale: tr }
                            ) 
                          : '---'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setViewingDuyuru(null)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
                  >
                    KAPAT
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

