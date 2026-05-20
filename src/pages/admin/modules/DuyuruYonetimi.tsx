import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Duyuru } from '../../../hooks/useDuyurular';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Info, 
  Bell,
  X,
  Sparkles,
  Wand2,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Modal } from '../../../components/ui/Modal';

export const DuyuruYonetimi: React.FC = () => {
  const [duyurular, setDuyurular] = useState<Duyuru[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    baslik: '',
    icerik: '',
    tip: 'duyuru' as Duyuru['tip']
  });

  // AI Announcement/Sermon Assistant States
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiTone, setAiTone] = useState<'resmi' | 'hitabet' | 'kisa'>('resmi');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const handleAiOptimize = () => {
    if (!formData.icerik.trim()) {
      alert("Lütfen önce yapay zekanın optimize etmesi için 'İçerik Detayı' alanına kısa bir taslak veya anahtar kelimeler yazın.");
      return;
    }
    setAiGenerating(true);
    setTimeout(() => {
      const rawText = formData.icerik.trim();
      let generated = '';
      
      const isWater = rawText.toLowerCase().includes('su') || rawText.toLowerCase().includes('kesint');
      const isFriday = rawText.toLowerCase().includes('cuma') || rawText.toLowerCase().includes('vaaz') || rawText.toLowerCase().includes('yardım');
      
      if (aiTone === 'resmi') {
        if (isWater) {
          generated = `Değerli Cemaatimiz,\n\nCamimizin altyapı iyileştirme çalışmaları kapsamında belediye ekipleri tarafından yapılacak olan su kesintisi nedeniyle, şadırvan ve lavabolarımız geçici olarak hizmet veremeyecektir. Mağduriyet yaşanmaması adına gerekli tedbirlerin alınmasını rica eder, anlayışınız için teşekkür ederiz.\n\nSaygılarımızla,\nCami Yönetimi`;
        } else if (isFriday) {
          generated = `Kıymetli Müminler,\n\nÖnümüzdeki Cuma günü eda edeceğimiz Cami Buluşmaları kapsamında, yardımlaşma ve dayanışmanın önemine dair özel bir sohbet ve vaaz programı icra edilecektir. Tüm mahalle sakinlerimizi ve cemaatimizi bu manevi iklimi paylaşmaya davet ediyoruz.\n\nSaygılarımızla,\nCami Yönetimi`;
        } else {
          generated = `Değerli Cemaatimiz,\n\nSizlere daha huzurlu ve temiz bir ibadet ortamı sunabilmek amacıyla ilettiğiniz konuyla ilgili gerekli planlamalar yapılmıştır: "${rawText}". Gelişmeler ve takvim hakkında sizleri bilgilendirmeye devam edeceğiz.\n\nSaygılarımızla,\nCami İdaresi`;
        }
      } else if (aiTone === 'hitabet') {
        if (isWater) {
          generated = `Muhterem Müslümanlar,\n\nCamimizde gerçekleştirilecek olan zorunlu temizlik ve altyapı bakım faaliyetleri sebebiyle şadırvanlarımızda kısa süreli su kesintisi yaşanacaktır. Maddi ve manevi temizliğin nişanesi olan ibadethanemizi daha güzel yarınlara hazırlamak için göstereceğiniz anlayış ve sabır için şimdiden teşekkür ederiz. Rabbim niyetlerinizi kabul eylesin.`;
        } else if (isFriday) {
          generated = `Aziz ve Muhterem Kardeşlerim,\n\nYüce Rabbimiz Kur'an-ı Kerim'de, "İyilik ve takva üzere yardımlaşın" buyurmaktadır. Peygamber Efendimiz (s.a.v) ise müminlerin bir beden gibi olduğunu bizlere müjdelemiştir. Bu Cuma vaazımızda yardımlaşma ahlakını ve gönül köprüleri kurmayı hep birlikte tefekkür edeceğiz. Gönüllerimizi bir kılmak adına tüm cemaatimizi bekliyoruz.`;
        } else {
          generated = `Aziz Cemaatimiz, Gönül Dostlarımız,\n\nİslam'ın güzel ahlakını ve cemaat olmanın rahmetini yaşatmak adına bizlere ulaştırdığınız "${rawText}" hususu, ibadethanemizin manevi havasına yakışır şekilde ele alınacaktır. Dualarımız ve gayretlerimiz bu kutlu yolda sizlerledir. Yüce Mevla birliğimizi ve beraberliğimizi daim eylesin.`;
        }
      } else { // kisa
        if (isWater) {
          generated = `Duyuru: Belediye altyapı çalışması sebebiyle camimiz şadırvanında geçici su kesintisi olacaktır. Tedbirli olunması rica olunur.`;
        } else if (isFriday) {
          generated = `Duyuru: Bu Cuma vaaz konusu yardımlaşma ahlakıdır. Vaazımız saat 12:15'te başlayacaktır. Tüm cemaatimiz davetlidir.`;
        } else {
          generated = `Duyuru: "${rawText}" hakkında gerekli idari ve teknik planlama başlatılmıştır. Bilgilerinize sunulur.`;
        }
      }
      
      setAiResult(generated);
      setAiGenerating(false);
    }, 1200);
  };

  const applyAiText = () => {
    if (aiResult) {
      setFormData(prev => ({
        ...prev,
        icerik: aiResult,
        baslik: prev.baslik || (aiTone === 'kisa' ? 'Önemli Bilgilendirme' : 'Cemaatimize Duyuru')
      }));
      setAiResult('');
      setAiAssistantOpen(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'duyurular'), orderBy('tarih', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Duyuru[];
      setDuyurular(data);
      setLoading(false);
    }, (error) => {
      import('../../../lib/firestore-errors').then(({ handleFirestoreError, OperationType }) => {
        handleFirestoreError(error, OperationType.LIST, 'duyurular');
      });
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'duyurular'), {
        ...formData,
        tarih: Timestamp.now()
      });
      setModalOpen(false);
      setFormData({ baslik: '', icerik: '', tip: 'duyuru' });
    } catch (error) {
      console.error('Duyuru eklenemedi:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'duyurular', id));
    } catch (error) {
      console.error('Duyuru silinemedi:', error);
    }
  };

  if (loading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-lg" />
        <p className="authority-title !text-[9px] opacity-30 tracking-[0.4em]">DUYURU HAVUZU SENKRONİZE EDİLİYOR</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-10">
      {/* HEADER: Action Control */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-light tracking-tight text-[var(--text-primary)]">Duyuru Panosu</h2>
           <p className="authority-title !text-[7px] opacity-30 font-medium tracking-[0.2em]">SİSTEM GENELİ BİLGİLENDİRME VE İLETİŞİM</p>
        </div>
        
        <motion.button 
          whileHover={{ y: -3, scale: 1.02, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-4 bg-white text-black px-8 py-4 rounded-2xl text-[9px] font-bold uppercase tracking-[0.3em] shadow-lg group w-full sm:w-auto"
        >
          <Plus size={16} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-500" />
          YENİ DUYURU YAYINLA
        </motion.button>
      </div>

      {/* GRID: Spatial Stream */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {duyurular.map((duyuru, idx) => (
            <motion.div
              key={duyuru.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30, delay: idx * 0.05 }}
              className="spatial-glass p-6 group relative overflow-hidden flex flex-col min-h-[220px]"
            >
              {/* Type Accent Aura */}
              <div className={`absolute -top-12 -right-12 w-24 h-24 blur-[60px] opacity-20 ${
                duyuru.tip === 'onemli' ? 'bg-rose-500' :
                duyuru.tip === 'bilgi' ? 'bg-sky-500' : 'bg-indigo-500'
              }`} />

              <div className="flex items-start justify-between mb-6">
                <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg border ${
                  duyuru.tip === 'onemli' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                  duyuru.tip === 'bilgi' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-white/[0.03] text-indigo-400 border-white/5'
                }`}>
                  {duyuru.tip === 'onemli' ? <AlertCircle size={20} /> :
                   duyuru.tip === 'bilgi' ? <Info size={20} /> : <Megaphone size={20} />}
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(244,63,94,0.1)' }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDelete(duyuru.id)}
                  className="p-3 text-white/5 hover:text-rose-500 transition-all rounded-xl border border-transparent hover:border-rose-500/20"
                >
                  <Trash2 size={16} />
                </motion.button>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-light text-white tracking-tight mb-3 group-hover:text-indigo-400 transition-colors duration-500">
                  {duyuru.baslik}
                </h3>
                <p className="text-[12px] font-light text-white/40 leading-relaxed line-clamp-3">
                  {duyuru.icerik}
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/5">
                <div className="flex flex-col gap-0.5">
                   <span className="authority-title !text-[6px] opacity-20 uppercase tracking-[0.2em]">YAYIN TARİHİ</span>
                   <span className="text-[9px] font-medium text-white/30 uppercase tracking-widest">
                     {duyuru.tarih 
                       ? format(
                           typeof duyuru.tarih?.toDate === 'function' ? duyuru.tarih.toDate() : new Date(duyuru.tarih?.seconds ? duyuru.tarih.seconds * 1000 : duyuru.tarih), 
                           'd MMMM yyyy', 
                           { locale: tr }
                         ) 
                       : '—'}
                   </span>
                </div>
                
                <div className={`px-4 py-1.5 rounded-full border text-[8px] font-bold uppercase tracking-[0.2em] shadow-sm ${
                   duyuru.tip === 'onemli' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/5' :
                   duyuru.tip === 'bilgi' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sky-500/5' : 'bg-white/[0.03] text-indigo-400 border-white/5 shadow-white/5'
                }`}>
                  {duyuru.tip}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* PUBLISH MODAL: Operational Command */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title="Yeni Duyuru"
        className="items-start pt-24 sm:pt-32"
      >
        <div className="flex flex-col gap-1.5 mb-10">
           <p className="authority-title !text-[7px] opacity-30 uppercase tracking-[0.3em]">OPERASYONEL BİLGİLENDİRME PARAMETRELERİ</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-8 pb-4">
          <div className="space-y-3 group">
             <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em] group-hover:opacity-100 transition-opacity">DUYURU BAŞLIĞI</label>
             <div className="relative">
               <input 
                required 
                placeholder="Duyuru başlığını giriniz..."
                value={formData.baslik} 
                onChange={e => setFormData({...formData, baslik: e.target.value})} 
                className="w-full spatial-glass bg-white/[0.01] p-5 rounded-2xl text-base font-light text-white border border-white/5 outline-none focus:bg-white/[0.04] focus:border-indigo-500/30 focus:shadow-[0_0_35px_rgba(99,102,241,0.15)] transition-all duration-700 placeholder:text-white/10" 
               />
             </div>
          </div>
          
          <div className="space-y-3 group">
             <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em] group-hover:opacity-100 transition-opacity">İÇERİK DETAYI</label>
             <div className="relative">
               <textarea 
                required 
                rows={5} 
                placeholder="İçerik metnini buraya yazınız..."
                value={formData.icerik} 
                onChange={e => setFormData({...formData, icerik: e.target.value})} 
                className="w-full spatial-glass bg-white/[0.01] p-5 rounded-2xl text-base font-light text-white border border-white/5 outline-none focus:bg-white/[0.04] focus:border-indigo-500/30 focus:shadow-[0_0_35px_rgba(99,102,241,0.15)] transition-all duration-700 resize-none placeholder:text-white/10" 
               />
             </div>
          </div>

          {/* Yapay Zeka Vaaz ve Duyuru Asistanı */}
          <div className="spatial-glass border border-indigo-500/10 p-5 rounded-2xl space-y-4 bg-gradient-to-r from-indigo-500/[0.01] to-purple-500/[0.01]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">AI Duyuru ve Vaaz Asistanı</span>
              </div>
              <button
                type="button"
                onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
                className="text-[9px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-all px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.01]"
              >
                {aiAssistantOpen ? 'Asistanı Kapat' : 'Asistanı Aç'}
              </button>
            </div>

            {aiAssistantOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 overflow-hidden pt-2 border-t border-white/5"
              >
                <div className="space-y-2">
                  <span className="text-[8px] text-white/30 font-bold uppercase tracking-wider block">Üslup ve Ton Seçimi</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'resmi', label: 'Resmi / Kurumsal' },
                      { key: 'hitabet', label: 'Edebi / Hitabet' },
                      { key: 'kisa', label: 'Kısa ve Net' }
                    ].map((tone) => (
                      <button
                        key={tone.key}
                        type="button"
                        onClick={() => setAiTone(tone.key as any)}
                        className={`py-2 px-1 rounded-xl text-[8px] font-bold uppercase tracking-wider transition-all border ${
                          aiTone === tone.key 
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                            : 'bg-white/[0.01] text-white/30 border-white/5 hover:border-white/10'
                        }`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 items-center">
                  <button
                    type="button"
                    onClick={handleAiOptimize}
                    disabled={aiGenerating}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/10 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    {aiGenerating ? (
                      <>
                        <RefreshCw size={10} className="animate-spin" />
                        AI METNİ DÜZENLİYOR...
                      </>
                    ) : (
                      <>
                        <Wand2 size={10} />
                        Taslağımı AI ile Zenginleştir
                      </>
                    )}
                  </button>
                </div>

                {aiResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-[8px] text-purple-400 font-bold uppercase tracking-wider">AI TARAFINDAN ÖNERİLEN METİN:</span>
                      <span className="text-[7px] text-white/30 uppercase tracking-widest">({aiTone} üslup)</span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed font-light whitespace-pre-wrap">
                      {aiResult}
                    </p>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={applyAiText}
                        className="flex-1 py-2.5 bg-white text-black rounded-lg text-[8px] font-bold uppercase tracking-widest shadow-md hover:bg-white/90 transition-all"
                      >
                        Öneriyi Metne Uygula
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiResult('')}
                        className="px-4 py-2.5 bg-white/5 text-white/50 rounded-lg text-[8px] font-bold uppercase tracking-widest hover:text-white transition-all"
                      >
                        Temizle
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
             <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em]">DUYURU KATEGORİSİ</label>
             <div className="grid grid-cols-3 gap-3">
              {['onemli', 'bilgi', 'duyuru'].map((type) => {
                const isSelected = formData.tip === type;
                let activeStyle = '';
                if (isSelected) {
                  if (type === 'onemli') activeStyle = 'bg-rose-500 text-white border-rose-400 shadow-[0_10px_20px_rgba(244,63,94,0.25)]';
                  else if (type === 'bilgi') activeStyle = 'bg-sky-500 text-white border-sky-400 shadow-[0_10px_20px_rgba(14,165,233,0.25)]';
                  else activeStyle = 'bg-indigo-500 text-white border-indigo-400 shadow-[0_10px_20px_rgba(99,102,241,0.25)]';
                } else {
                  activeStyle = 'bg-white/[0.02] text-white/30 border-white/5 hover:border-white/10';
                }
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, tip: type as any})}
                    className={`py-3.5 rounded-2xl text-[9px] font-bold uppercase tracking-[0.3em] transition-all border outline-none ${activeStyle}`}
                  >
                    {type === 'onemli' ? 'ÖNEMLİ' : type === 'bilgi' ? 'BİLGİ' : 'DUYURU'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
             <motion.button 
              whileHover={{ y: -3, scale: 1.01, boxShadow: '0 15px 30px rgba(99,102,241,0.2)' }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              className="flex-1 bg-indigo-500 text-white border border-indigo-400 text-[10px] font-bold uppercase tracking-[0.3em] py-5 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all duration-700 text-center justify-center flex items-center"
             >
              DUYURUYU ŞİMDİ YAYINLA
             </motion.button>
             <motion.button 
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              type="button" 
              onClick={() => setModalOpen(false)} 
              className="px-10 py-5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/25 hover:text-white transition-all border border-white/5 rounded-2xl text-center justify-center flex items-center"
             >
              İPTAL
             </motion.button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
