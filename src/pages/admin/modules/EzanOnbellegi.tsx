import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, writeBatch, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { format, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AylikVakitler, Muezzin } from '../../../types';
import { tieBreakerSirala } from '../../../utils/tieBreaker';
import { Database, Globe, Github, Zap, RefreshCw, Save, CheckCircle2, AlertCircle, Settings2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function EzanOnbellegi() {
  const [onbellekler, setOnbellekler] = useState<(AylikVakitler & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKaynak, setApiKaynak] = useState('diyanet');
  const [githubConfig, setGithubConfig] = useState({ 
    pat: '', 
    owner: 'mft-collab', 
    repo: 'muezzin' 
  });
  const [saving, setSaving] = useState(false);
  const [localTriggering, setLocalTriggering] = useState(false);
  const [uiMessage, setUiMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const unsubscribeVakitler = onSnapshot(collection(db, 'vakitler'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (AylikVakitler & { id: string })[];
      data.sort((a, b) => b.id.localeCompare(a.id));
      setOnbellekler(data);
      setLoading(false);
    }, (error) => {
      console.error("Firebase unsubscribeVakitler onSnapshot error:", error);
    });

    const unsubscribeConfig = onSnapshot(doc(db, 'config', 'github'), (docSnap) => {
      if (docSnap.exists()) {
        setGithubConfig(docSnap.data() as any);
      }
    }, (error) => {
      console.error("Firebase unsubscribeConfig onSnapshot error:", error);
    });

    return () => {
      unsubscribeVakitler();
      unsubscribeConfig();
    };
  }, []);

  const saveGithubConfig = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'github'), githubConfig);
      setUiMessage({ type: 'success', text: 'GitHub ayarları başarıyla kaydedildi.' });
    } catch (err: any) {
      setUiMessage({ type: 'error', text: 'Ayarlar kaydedilirken hata oluştu: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const triggerLocalAction = async () => {
    setLocalTriggering(true);
    setUiMessage(null);
    try {
      const muezzinSnapshot = await getDocs(query(collection(db, 'muezzins'), where('aktif', '==', true)));
      const muezzinler = muezzinSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Muezzin & { id: string }));

      if (muezzinler.length < 2) {
        throw new Error('En az 2 aktif müezzin olması gerekir!');
      }

      // Proaktif İzin Kontrolü: Onaylanmış izinleri çek
      const izinSnap = await getDocs(query(collection(db, 'izinler'), where('durum', '==', 'onaylandi')));
      const onayliIzinler = izinSnap.docs.map(d => d.data());

      const simdi = new Date();
      const pazartesi = startOfWeek(simdi, { weekStartsOn: 1 });
      const haftaBaslangicStr = format(pazartesi, 'yyyy-MM-dd');
      const haftaId = `W${haftaBaslangicStr}`;
      
      const gunler: string[] = [];
      for(let i=0; i<7; i++) {
        const gun = new Date(pazartesi);
        gun.setDate(pazartesi.getDate() + i);
        gunler.push(format(gun, 'yyyy-MM-dd'));
      }
      const haftaBitisStr = gunler[6];

      const buHaftakiYukler: Record<string, number> = {};
      muezzinler.forEach(m => buHaftakiYukler[m.id] = 0);

      const vakitler = ['sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'];
      const gunPlan: any = {};
      const batch = writeBatch(db);

      for (const gun of gunler) {
        gunPlan[gun] = {};
        
        // Bu gün izinli olanları belirle
        const bugunIzinliUidler = onayliIzinler
          .filter(izin => gun >= izin.baslangic && gun <= izin.bitis)
          .map(izin => izin.uid);

        // Adayları bugün çalışabilecek müezzinlerle filtrele
        const musaitMuezzinler = muezzinler.filter(m => !bugunIzinliUidler.includes(m.id));

        for (const vakit of vakitler) {
          if (musaitMuezzinler.length < 2) {
             // Eğer müsait kimse yoksa fallback: Hepsini dahil et ama uyarı ver (veya sadece aktifleri al)
             // Not: Bu durum nadir olmalı, admin manuel müdahale edebilir.
             gunPlan[gun][vakit] = { asil: 'SISTEM', yedek: 'SISTEM' };
             continue;
          }

          const sirali = tieBreakerSirala(musaitMuezzinler, buHaftakiYukler);
          // 0. index en az yükü olan -> Asil
          const asil = sirali[0];
          // 1. index ondan sonraki en az yükü olan -> Yedek
          const yedek = sirali[1];
          
          // Görev verildiği için Asil'in yükünü 1 artırıyoruz ki diğer vakitlerde başkalarına sıra gelsin
          buHaftakiYukler[asil.id] += 1;

          gunPlan[gun][vakit] = { asil: asil.id, yedek: yedek.id };
          
          const bAsil = doc(collection(db, 'bildirimler'));
          batch.set(bAsil, {
            haftaId, tarih: gun, vakit, uid: asil.id, tip: 'asil',
            durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(), sonGuncelleme: Timestamp.now()
          });
          const bYedek = doc(collection(db, 'bildirimler'));
          batch.set(bYedek, {
            haftaId, tarih: gun, vakit, uid: yedek.id, tip: 'yedek',
            durum: 'bekliyor', pendingAck: true, olusturmaTarihi: Timestamp.now(), sonGuncelleme: Timestamp.now()
          });
        }
      }

      batch.set(doc(db, 'haftaPlanlari', haftaId), {
        haftaBaslangic: haftaBaslangicStr, haftaBitis: haftaBitisStr,
        durum: 'yayinda', olusturmaTarihi: Timestamp.now(), gunler: gunPlan
      });

      await batch.commit();
      setUiMessage({ type: 'success', text: "Haftalık plan başarıyla yayına alındı." });
    } catch (err: any) {
      setUiMessage({ type: 'error', text: err.message });
    } finally {
      setLocalTriggering(false);
    }
  };

  const triggerGithubAction = async (ay: string) => {
    const { pat, owner, repo } = githubConfig;
    if (!pat || !owner || !repo) {
      setUiMessage({ type: 'error', text: "GitHub ayarları eksik. Lütfen yapılandırın." });
      return;
    }

    setUiMessage(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/aylik-ezan-takvimi.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { ay, kaynak: apiKaynak }
        })
      });

      if (res.ok) {
        setUiMessage({ type: 'success', text: `${ay} ayı için ${apiKaynak.toUpperCase()} üzerinden güncelleme başlatıldı.` });
      } else {
        const err = await res.text();
        throw new Error(`GitHub Yanıtı (${res.status}): ${err}`);
      }
    } catch (e: any) {
      setUiMessage({ type: 'error', text: e.message });
    }
  };

  if (loading) return (
     <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
           <RefreshCw className="animate-spin text-slate-400" size={32} />
           <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">SİSTEM VERİLERİ YÜKLENİYOR</p>
        </div>
     </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 pb-8 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">SİSTEM & VERİ HUB</h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-2">ULUSLARARASI TAKVİM ENTEGRASYONU VE OPERATÖR PANELİ</p>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-900/10 border border-slate-800">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">SERVİS DURUMU: AKTİF</span>
        </div>
      </header>

      {/* Global Status Message */}
      <AnimatePresence>
        {uiMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`p-6 rounded-2xl flex items-center gap-4 border mb-8 ${
              uiMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-sm' 
              : 'bg-rose-50 border-rose-100 text-rose-700 shadow-sm'
            }`}
          >
            {uiMessage.type === 'success' ? <CheckCircle2 size={24} className="text-emerald-500" strokeWidth={1.5} /> : <AlertCircle size={24} className="text-rose-500" strokeWidth={1.5} />}
            <p className="text-xs font-bold uppercase tracking-tight">{uiMessage.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
         {/* Left Side: API Source Selection & triggering */}
         <div className="lg:col-span-2 space-y-10">
            <section className="bg-white/70 backdrop-blur-2xl rounded-3xl border border-slate-200/60 p-8 sm:p-10 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-center gap-3 mb-10">
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-xl shadow-inner"><Globe size={20} /></div>
                  <div>
                    <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wider">ZAMAN ÇİZELGESİ SENKRONİZASYONU</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">DIŞ VERİ KAYNAKLARI VE API SEÇİMİ</p>
                  </div>
               </div>
               
               <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-12">
                  {['diyanet', 'aladhan', 'london'].map((k) => (
                     <motion.button 
                        key={k}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setApiKaynak(k)}
                        className={`p-6 sm:p-8 rounded-2xl border transition-all flex flex-col items-center gap-5 relative overflow-hidden group shadow-sm ${
                           apiKaynak === k 
                           ? 'border-indigo-600 bg-indigo-600 text-white shadow-indigo-900/20' 
                           : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                        }`}
                     >
                        <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                           apiKaynak === k ? 'text-indigo-100' : 'text-slate-400'
                        }`}>
                           {k === 'diyanet' ? 'DİYANET' : k === 'aladhan' ? 'ALADHAN' : 'LONDON'}
                        </span>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-105 ${
                           apiKaynak === k ? 'bg-white text-indigo-600' : 'bg-white text-slate-300 border border-slate-100'
                        }`}>
                           <Globe size={24} />
                        </div>
                        {apiKaynak === k && (
                           <div className="absolute top-4 right-4 w-2 h-2 bg-white rounded-full animate-pulse" />
                        )}
                     </motion.button>
                  ))}
               </div>

               <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white/50">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-100">
                           <th className="px-8 py-5">REFERANS AY</th>
                           <th className="px-8 py-5">SAĞLAYICI</th>
                           <th className="px-8 py-5 text-right">EYLEM</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 text-slate-900 font-sans">
                        {onbellekler.map(o => (
                           <tr key={o.id} className="group hover:bg-slate-50/40 transition-colors">
                              <td className="px-8 py-6">
                                 <p className="text-lg font-bold text-slate-900 tracking-tighter leading-none">{o.id.toUpperCase()}</p>
                                 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                                    <div className={`w-1 h-1 rounded-full ${o.guncellenmeTarihi ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                                    {o.guncellenmeTarihi 
                                      ? format(
                                          typeof o.guncellenmeTarihi?.toDate === 'function' ? o.guncellenmeTarihi.toDate() : new Date(o.guncellenmeTarihi?.seconds ? o.guncellenmeTarihi.seconds * 1000 : o.guncellenmeTarihi), 
                                          'dd MMMM yyyy • HH:mm', 
                                          { locale: tr }
                                        ).toUpperCase() 
                                      : 'VERİ YOK'}
                                 </div>
                              </td>
                              <td className="px-8 py-6">
                                 <span className="text-[9px] font-bold uppercase tracking-widest bg-slate-900 text-white px-3 py-1.5 rounded-lg">
                                    {o.kaynakApi?.toUpperCase() || 'OTOMATİK'}
                                 </span>
                              </td>
                              <td className="px-8 py-6 text-right">
                                 <button 
                                    onClick={() => triggerGithubAction(o.id)}
                                    className="p-3.5 bg-white text-slate-400 rounded-xl shadow-sm border border-slate-200 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                    title="Servisi Tetikle"
                                 >
                                    <RefreshCw size={18} />
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </section>

            <section className="bg-slate-900 rounded-3xl border border-slate-800 p-10 shadow-xl overflow-hidden relative">
               <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12">
                  <Zap size={200} />
               </div>
               <div className="flex justify-between items-center mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                        <Zap size={24} />
                     </div>
                     <div>
                        <h2 className="text-base font-bold uppercase text-white tracking-widest">ACİL DURUM TETİKLEYİCİ</h2>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">MANUEL HAFTA YAYINI</p>
                     </div>
                  </div>
               </div>
               <p className="text-sm text-white/60 font-medium leading-relaxed mb-10 max-w-lg relative z-10">
                  Eğer otonom sistemler yanıt vermezse veya acil bir değişiklik gerekiyorsa, mevcut tüm personeli kullanarak haftalık planı manuel olarak zorla yayına alabilirsiniz.
               </p>
               <button 
                  onClick={triggerLocalAction} 
                  disabled={localTriggering}
                  className="bg-white text-slate-900 w-full py-6 rounded-2xl font-bold text-[12px] tracking-widest uppercase shadow-2xl hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-4 group relative z-10"
               >
                  {localTriggering ? <RefreshCw className="animate-spin" size={20} /> : <Zap size={20} className="group-hover:animate-pulse" />}
                  {localTriggering ? 'İŞLEM SÜRÜYOR...' : 'HAFTALIK PLANI HEMEN YAYINLA'}
               </button>
            </section>
         </div>

         {/* Right Side: Settings */}
         <div className="space-y-10">
            <section className="bg-white rounded-3xl border border-slate-200 p-10 shadow-sm relative overflow-hidden">
               <div className="flex items-center gap-3 mb-10">
                  <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl shadow-inner"><Settings2 size={20} /></div>
                  <h2 className="text-sm font-bold uppercase text-slate-900 tracking-wider">SİSTEM PARAMETRELERİ</h2>
               </div>
               
               <div className="space-y-10">
                  <div className="space-y-6">
                     <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 ml-1">GITHUB GÜVENLİK ANAHTARI (PAT)</label>
                        <div className="relative mt-2">
                           <Github className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                           <input 
                              type="password" 
                              placeholder="Hiyerarşik Erişim Anahtarı..." 
                              value={githubConfig.pat} 
                              onChange={e => setGithubConfig({...githubConfig, pat: e.target.value})} 
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-5 pl-14 pr-5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300" 
                           />
                        </div>
                     </div>
                     
                     <div className="space-y-6">
                        <div>
                           <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 ml-1">ORGANİZASYON / KULLANICI</label>
                           <input type="text" value={githubConfig.owner} onChange={e => setGithubConfig({...githubConfig, owner: e.target.value})} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl py-5 px-6 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                        <div>
                           <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 ml-1">DEPO İSİM (REPO)</label>
                           <input type="text" value={githubConfig.repo} onChange={e => setGithubConfig({...githubConfig, repo: e.target.value})} className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-2xl py-5 px-6 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all" />
                        </div>
                     </div>
                  </div>

                  <button 
                     onClick={saveGithubConfig} 
                     disabled={saving} 
                     className="w-full py-5 px-4 bg-slate-900 text-white rounded-2xl font-bold text-xs tracking-widest uppercase hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 group"
                  >
                     {saving ? <RefreshCw className="animate-spin mx-auto" size={20} /> : (
                       <div className="flex items-center justify-center gap-3">
                         <Save size={18} /> AYARLARI SİSTEME İŞLE
                       </div>
                     )}
                  </button>
               </div>
            </section>

            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 flex items-start gap-4">
               <Info size={24} className="text-slate-400 flex-shrink-0" />
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed italic">
                  Bot servisleri her gece otomatik olarak veri senkronizasyonu sağlar. Manual müdahale durumunda tetikleyiciyi 2 dakikadan daha sık kullanmayınız.
               </p>
            </div>
         </div>
      </div>
    </div>
  );

}
