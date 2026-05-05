import React, { useState } from 'react';
import { format, startOfWeek, subWeeks, addWeeks, parseISO, isSameDay, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useHaftaPlan } from '../hooks/useHaftaPlan';
import { useMuezzinler } from '../hooks/admin/useMuezzinler';
import { auth } from '../lib/firebase';
import { Calendar, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VAKIT_GORA_ISIMLERI } from '../lib/dateUtils';
import { Vakit } from '../types';

const getWeekString = (date: Date) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  return `W${format(weekStart, 'yyyy-MM-dd')}`;
};

const VAKIT_LISTESI: Vakit[] = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];

export default function HaftalikTakvim() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const haftaId = getWeekString(currentDate);
  const { plan, loading: planLoading } = useHaftaPlan(haftaId);
  const { muezzinler, loading: usersLoading } = useMuezzinler();
  const currentUser = auth.currentUser;

  const loading = planLoading || usersLoading;

  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekLabel = `${format(currentWeekStart, 'd MMMM', { locale: tr })}`;

  const getMuezzinName = (uid: string) => {
    if (!uid) return 'Atanmamış';
    if (uid === 'SISTEM') return 'Sistem';
    return muezzinler.find(m => m.id === uid)?.displayName || 'Bilinmiyor';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-0 md:px-8 pb-32 min-h-screen">
      {/* Dynamic Background Flair */}
      <div className="fixed inset-0 pointer-events-none z-0 hidden md:block bg-slate-50">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-200/50 rounded-full blur-[120px]" />
      </div>

      <header className="relative z-10 mb-16 pt-8 md:pt-16 px-4 md:px-0">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
          <div className="max-w-2xl">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="px-3 py-1.5 bg-slate-900 text-white rounded-full text-[9px] font-bold uppercase tracking-[0.25em] shadow-[0_8px_20px_rgba(0,0,0,0.1)]">
                Planlama Modülü
              </div>
              <div className="h-px w-16 bg-slate-200" />
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-[5.5rem] font-sans font-light text-slate-900 tracking-tighter leading-[1.1]"
            >
              Haftalık Görev <br className="hidden md:block" /><span className="font-medium text-slate-400">Çizelgesi</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 text-slate-500 font-medium text-sm md:text-base leading-relaxed tracking-tight max-w-lg"
            >
              Cami hizmetlerinin aksamaması için hazırlanan 7 günlük görev dağılımı. Kişisel nöbetlerinizi buradan takip edebilirsiniz.
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-1 bg-white/80 p-2 rounded-full border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] self-start lg:self-auto backdrop-blur-xl"
          >
            <button 
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))} 
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all active:scale-90"
            >
              <ChevronLeft size={20} className="ml-[-2px]" />
            </button>
            <div className="px-6 py-2 text-sm font-semibold tracking-tight text-slate-900 min-w-[220px] text-center">
              {weekLabel} – {format(addWeeks(currentWeekStart, 1), 'd MMMM', { locale: tr })}
            </div>
            <button 
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))} 
              className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all active:scale-90"
            >
              <ChevronRight size={20} className="mr-[-2px]" />
            </button>
          </motion.div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-10 relative z-10">
          <div className="relative">
            <div className="w-20 h-20 border-2 border-slate-100 rounded-full border-t-slate-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="text-slate-400 animate-pulse" size={24} />
            </div>
          </div>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-[0.3em] animate-pulse">Sistem Arşivi Taranıyor</p>
        </div>
      ) : !plan ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-white p-16 lg:p-32 rounded-[48px] border border-slate-100 text-center max-w-4xl mx-auto shadow-xl shadow-slate-200/20 my-20"
        >
          <div className="w-24 h-24 bg-slate-900 text-white rounded-[32px] flex items-center justify-center mb-10 mx-auto">
            <Info size={40} />
          </div>
          <h3 className="text-4xl md:text-5xl font-sans font-light text-slate-900 mb-6 tracking-tighter leading-none">Veri Bekleniyor</h3>
          <p className="text-slate-500 text-base font-medium leading-relaxed max-w-md mx-auto mb-12">
            Seçilen haftaya ait görev planı henüz oluşturulmamış veya yönetici tarafından taslak aşamasında tutuluyor.
          </p>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="px-10 py-5 bg-slate-900 text-white rounded-[24px] text-[10px] font-medium uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
          >
            Güncel Haftaya Dön
          </button>
        </motion.div>
      ) : (
        <div className="relative z-10 flex flex-col gap-2">
            {Array.from({ length: 7 }).map((_, idx) => {
              const parsedDate = addDays(currentWeekStart, idx);
              const tarih = format(parsedDate, 'yyyy-MM-dd');
              const gunObj = plan.gunler[tarih] || {};
              const isToday = isSameDay(parsedDate, new Date());
              const gunAdi = format(parsedDate, 'EEEE', { locale: tr });
              const gunAyi = format(parsedDate, 'MMMM', { locale: tr });

              return (
                <div 
                  key={tarih}
                  className={`relative overflow-hidden group ${isToday ? 'px-0 sm:px-0' : 'px-4 sm:px-0'}`}
                >
                  {(() => {
                    const asiller = Array.from(new Set(VAKIT_LISTESI.map(v => gunObj[v]?.asil).filter(Boolean)));
                    const yedekler = Array.from(new Set(VAKIT_LISTESI.map(v => gunObj[v]?.yedek).filter(Boolean)));
                    const isPersonalDuty = currentUser && (asiller.includes(currentUser.uid) || yedekler.includes(currentUser.uid));

                    return (
                      <div 
                        className={`flex flex-col sm:flex-row items-start sm:items-center p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden gap-4 sm:gap-6 ${
                          isPersonalDuty && isToday
                            ? 'bg-amber-500 border-amber-600 shadow-md text-white'
                            : isPersonalDuty
                            ? 'bg-amber-50/80 border-amber-200 shadow-sm text-amber-950'
                            : isToday
                            ? 'bg-slate-900 border-slate-800 shadow-md text-white'
                            : 'bg-white border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        {/* Compact Date Section */}
                        <div className="flex items-center gap-4 min-w-[120px] shrink-0">
                          <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${
                            isPersonalDuty && isToday ? 'bg-white/20 text-white' 
                            : isPersonalDuty ? 'bg-amber-200/50 text-amber-800' 
                            : isToday ? 'bg-white/10 text-white' 
                            : 'bg-slate-100 text-slate-600'
                          }`}>
                            <span className="text-lg font-bold leading-none">{format(parsedDate, 'd')}</span>
                            <span className="text-[9px] uppercase font-semibold tracking-wider mt-0.5">{gunAyi.substring(0, 3)}</span>
                          </div>
                          <div>
                            <h4 className={`text-base font-medium tracking-tight ${
                              (isPersonalDuty && isToday) || isToday ? 'text-white' : 'text-slate-800'
                            }`}>
                              {gunAdi}
                            </h4>
                            {isToday && (
                              <span className={`text-[9px] uppercase font-bold tracking-widest ${
                                isPersonalDuty ? 'text-amber-200' : 'text-slate-400'
                              }`}>
                                Bugün
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Minimal Divider */}
                        <div className={`hidden sm:block w-px h-10 ${
                          (isPersonalDuty && isToday) || isToday ? 'bg-white/20' : 'bg-slate-200'
                        }`} />

                        {/* Assignments */}
                        <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-x-8 gap-y-3 w-full">
                          {/* Asiller */}
                          <div className="flex-1 flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] uppercase font-bold tracking-widest ${
                              (isPersonalDuty && isToday) || isToday ? 'text-white/50' : 'text-slate-400'
                            }`}>
                              Asil:
                            </span>
                            {asiller.length > 0 ? asiller.map((uid) => (
                              <span 
                                key={uid} 
                                className={`text-sm font-medium px-2 py-1 rounded-md ${
                                  uid === currentUser?.uid 
                                    ? ((isPersonalDuty && isToday) || isToday ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900 font-semibold')
                                    : ''
                                }`}
                              >
                                {getMuezzinName(uid)}
                              </span>
                            )) : (
                              <span className="text-sm opacity-50">—</span>
                            )}
                          </div>

                          {/* Yedekler */}
                          <div className="flex-1 flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] uppercase font-bold tracking-widest ${
                              (isPersonalDuty && isToday) || isToday ? 'text-white/50' : 'text-slate-400'
                            }`}>
                              Yedek:
                            </span>
                            {yedekler.length > 0 ? yedekler.map((uid) => (
                              <span 
                                key={uid} 
                                className={`text-sm font-medium px-2 py-1 rounded-md ${
                                  uid === currentUser?.uid 
                                    ? ((isPersonalDuty && isToday) || isToday ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900 font-semibold')
                                    : ''
                                }`}
                              >
                                {getMuezzinName(uid)}
                              </span>
                            )) : (
                              <span className="text-sm opacity-50">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
