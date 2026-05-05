import React from 'react';
import { motion } from 'motion/react';
import { Users, User, AlertCircle } from 'lucide-react';

interface Props {
  asilIsim?: string;
  yedekIsim?: string;
  planVarMi: boolean;
  isAsilSizMisiniz?: boolean;
  isYedekSizMisiniz?: boolean;
  asilIzinde?: boolean;
  yedekIzinde?: boolean;
  asilSabitIzinde?: boolean;
  yedekSabitIzinde?: boolean;
}

export const HademelerListesi: React.FC<Props> = ({ 
  asilIsim, 
  yedekIsim, 
  planVarMi,
  isAsilSizMisiniz,
  isYedekSizMisiniz,
  asilIzinde,
  yedekIzinde,
  asilSabitIzinde,
  yedekSabitIzinde
}) => {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.2 }}
      className="px-4 md:px-0"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm border border-blue-100">
          <Users size={16} />
        </div>
        <h2 className="text-[12px] font-medium uppercase tracking-widest text-blue-950/30">Vakit Görevli Heyeti</h2>
      </div>

      {planVarMi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <motion.div 
            whileHover={{ y: -4 }} 
            className={`p-6 rounded-[32px] border ${
              isAsilSizMisiniz 
                ? 'bg-amber-500 border-amber-600 shadow-[0_20px_40px_rgba(245,158,11,0.25)] text-white' 
                : 'bg-gradient-to-br from-amber-50 to-white border-amber-100/60 shadow-[0_4px_24px_rgba(180,83,9,0.04)] text-slate-900'
            } transition-all flex items-center gap-5 group relative overflow-hidden`}
          >
            {asilIzinde && (
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md border border-white/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-white">İZİNLİ</span>
              </div>
            )}
            {!asilIzinde && asilSabitIzinde && (
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md border border-white/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-white">SABİT İZİNLİ</span>
              </div>
            )}
            {!isAsilSizMisiniz && asilIzinde && (
              <div className="absolute top-4 right-4 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-blue-600">İZİNLİ</span>
              </div>
            )}
            {!isAsilSizMisiniz && !asilIzinde && asilSabitIzinde && (
              <div className="absolute top-4 right-4 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-indigo-600">SABİT İZİN</span>
              </div>
            )}
            {isAsilSizMisiniz && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"
              />
            )}
            <div className={`w-14 h-14 rounded-[20px] ${
              isAsilSizMisiniz 
                ? 'bg-white/20 text-white backdrop-blur-md' 
                : asilIsim === 'Sistem' ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-600'
            } flex items-center justify-center border ${isAsilSizMisiniz ? 'border-white/30' : 'border-amber-200/50'} shadow-inner shrink-0`}>
              <User size={24} strokeWidth={2} />
            </div>
            <div className="min-w-0 relative z-10">
              <span className={`text-[9px] uppercase font-bold tracking-widest block mb-1 ${isAsilSizMisiniz ? 'text-white/70' : 'text-amber-600/60'}`}>Birincil Hizmet Sorumlusu</span>
              <p className={`font-sans font-medium text-xl tracking-tight leading-none mb-1 truncate ${
                isAsilSizMisiniz ? 'text-white' : asilIsim === 'Sistem' ? 'italic opacity-40 text-slate-900' : 'text-slate-900'
              }`}>
                {asilIsim === 'Sistem' ? 'Zeki Atama...' : asilIsim}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${isAsilSizMisiniz ? 'text-white/50' : 'text-slate-400'}`}>İBADET VE İRAE AMİRİ</p>
            </div>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -4 }} 
            className={`p-6 rounded-[32px] border ${
              isYedekSizMisiniz 
                ? 'bg-indigo-600 border-indigo-700 shadow-[0_20px_40px_rgba(79,70,229,0.25)] text-white' 
                : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100/60 shadow-[0_4px_24px_rgba(30,58,138,0.04)] text-slate-900'
            } transition-all flex items-center gap-5 group relative overflow-hidden`}
          >
            {yedekIzinde && (
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md border border-white/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-white">İZİNLİ</span>
              </div>
            )}
            {!yedekIzinde && yedekSabitIzinde && (
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md border border-white/30 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-white">SABİT İZİNLİ</span>
              </div>
            )}
            {!isYedekSizMisiniz && yedekIzinde && (
              <div className="absolute top-4 right-4 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-blue-600">İZİNLİ</span>
              </div>
            )}
            {!isYedekSizMisiniz && !yedekIzinde && yedekSabitIzinde && (
              <div className="absolute top-4 right-4 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg flex items-center gap-1.5 z-20">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-indigo-600">SABİT İZİN</span>
              </div>
            )}
            {isYedekSizMisiniz && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"
              />
            )}
            <div className={`w-14 h-14 rounded-[20px] ${
              isYedekSizMisiniz 
                ? 'bg-white/20 text-white backdrop-blur-md' 
                : yedekIsim === 'Sistem' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-600'
            } flex items-center justify-center border ${isYedekSizMisiniz ? 'border-white/30' : 'border-indigo-200/50'} shadow-inner shrink-0`}>
              <Users size={24} strokeWidth={2} />
            </div>
            <div className="min-w-0 relative z-10">
              <span className={`text-[9px] uppercase font-bold tracking-widest block mb-1 ${isYedekSizMisiniz ? 'text-white/70' : 'text-indigo-600/60'}`}>Koordinasyon ve Destek</span>
              <p className={`font-sans font-medium text-xl tracking-tight leading-none mb-1 truncate ${
                isYedekSizMisiniz ? 'text-white' : yedekIsim === 'Sistem' ? 'italic opacity-40 text-slate-900' : 'text-slate-900'
              }`}>
                {yedekIsim === 'Sistem' ? 'Zeki Atama...' : yedekIsim}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${isYedekSizMisiniz ? 'text-white/50' : 'text-slate-400'}`}>TEKNİK VE LOJİSTİK DESTEK</p>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="p-16 bg-white rounded-[40px] border border-dashed border-black/10 text-gray-400 text-center flex flex-col items-center justify-center gap-5">
          <div className="w-16 h-16 rounded-[24px] bg-gray-50 border border-black/[0.03] flex items-center justify-center">
            <AlertCircle size={28} />
          </div>
          <div>
            <p className="font-medium text-xs uppercase tracking-widest text-gray-600 mb-2">Plan Bekleniyor</p>
            <p className="text-[11px] font-medium max-w-xs mx-auto opacity-80">Bugün için henüz bir personel ataması gerçekleştirilmedi.</p>
          </div>
        </div>
      )}
    </motion.section>
  );
};
