import React from 'react';
import { motion } from 'motion/react';
import { Star, CheckCircle2 } from 'lucide-react';
import { GorevKarti } from './GorevKarti';
import { Bildirim, GunlukVakit } from '../types';

interface Props {
  loading: boolean;
  gorevler: Bildirim[];
  bugunVakitler: GunlukVakit | null;
}

export const KisiselGorevAkisi: React.FC<Props> = ({ loading, gorevler, bugunVakitler }) => {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay: 0.3 }}
      className="px-4 md:px-0"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm border border-blue-100">
          <Star size={16} />
        </div>
        <h2 className="text-[12px] font-medium uppercase tracking-widest text-blue-950/30">Kişisel Hizmet Çizelgesi</h2>
      </div>

      {loading ? (
        <div className="p-24 text-center px-4">
          <div className="animate-spin h-14 w-14 border-[6px] border-gray-100 border-t-gray-400 rounded-full mx-auto" />
          <p className="text-[11px] font-medium uppercase text-gray-400 tracking-widest mt-10">Şahsi Görevleriniz Hazırlanıyor</p>
        </div>
      ) : gorevler.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-10 sm:p-16 rounded-[40px] border border-black/[0.03] text-center shadow-[0_4px_24px_rgb(0,0,0,0.02)] relative overflow-hidden group hover:shadow-[0_12px_32px_rgb(0,0,0,0.04)] transition-all">
          <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-[24px] flex items-center justify-center mx-auto mb-8 border border-black/[0.03] group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors duration-500">
            <CheckCircle2 size={36} strokeWidth={1.5} />
          </div>
          <h3 className="font-sans font-light text-3xl sm:text-4xl mb-4 tracking-tight text-gray-900">Münferit Vakitler</h3>
          <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500 max-w-sm mx-auto leading-relaxed mt-6">BUGÜNLÜK ATANMIŞ BİR HİZMETİNİZ BULUNMAMAKTADIR. VAKTİNİZİ HAYIRLA GEÇİREBİLİRSİNİZ.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {gorevler.map((g, index) => (
            <motion.div key={g.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + (index * 0.1) }}>
              <GorevKarti bildirim={g} saat={bugunVakitler ? bugunVakitler[g.vakit] : "00:00"} />
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
};
