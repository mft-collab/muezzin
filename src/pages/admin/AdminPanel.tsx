import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { onSnapshot, query, collection, where } from 'firebase/firestore';
import { useKrizAlarmlari } from '../../hooks/admin/useKrizAlarmlari';
import { useMuezzinler } from '../../hooks/admin/useMuezzinler';
import { useEzanVakitleri } from '../../hooks/useEzanVakitleri';
import { useSonrakiVakit } from '../../hooks/useSonrakiVakit';
import { useRole } from '../../hooks/useRole';
import { useLiveClock } from '../../hooks/useLiveClock';
import { getDynamicTheme } from '../../lib/themeUtils';
import { format } from 'date-fns';
import {
  Users,
  CalendarDays,
  Bell,
  Database,
  Award,
  History,
  LayoutDashboard,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SplashLoader } from '../../components/SplashLoader';

// Modules
import MuezzinYonetimi from './modules/MuezzinYonetimi';
import HaftalikCizelge from './modules/HaftalikCizelge';
import KrizAlarmlari from './modules/KrizAlarmlari';
import EzanOnbellegi from './modules/EzanOnbellegi';
import MuezzinPuanlari from './modules/MuezzinPuanlari';
import MazeretGecmisi from './modules/MazeretGecmisi';
import IzinYonetimi from './modules/IzinYonetimi';
import { DuyuruYonetimi } from './modules/DuyuruYonetimi';

const LiveClockDisplay = () => {
  const time = useLiveClock();
  return <span>{format(time, 'HH:mm:ss')}</span>;
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useRole();
  const time = useLiveClock();
  
  // Stats & States
  const { cozulmamisSayisi } = useKrizAlarmlari();
  const { muezzinler } = useMuezzinler();
  const [pendingIzinler, setPendingIzinler] = useState(0);
  const [activeDuyurular, setActiveDuyurular] = useState(0);
  
  const { bugunVakitler, yarinVakitler } = useEzanVakitleri();
  const sonraki = useSonrakiVakit(bugunVakitler, yarinVakitler);

  useEffect(() => {
    // Listen for pending izinler
    const unsubIzin = onSnapshot(query(collection(db, 'izinler'), where('durum', '==', 'bekliyor')), (snap) => {
      setPendingIzinler(snap.size);
    });
    // Listen for active duyurular (basitçe sayı)
    const unsubDuyuru = onSnapshot(collection(db, 'duyurular'), (snap) => {
      setActiveDuyurular(snap.size);
    });
    return () => {
      unsubIzin();
      unsubDuyuru();
    };
  }, []);

  const dynamicTheme = useMemo(() => getDynamicTheme(sonraki?.vakit), [sonraki?.vakit]);

  useEffect(() => {
    if (!roleLoading && isAdmin === false) {
      navigate('/');
    }
  }, [isAdmin, roleLoading, navigate]);

  if (roleLoading || isAdmin === null) return <SplashLoader />;
  if (!isAdmin) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'muezzinler': return <MuezzinYonetimi />;
      case 'cizelge': return <HaftalikCizelge />;
      case 'alarmlar': return <KrizAlarmlari />;
      case 'onbellek': return <EzanOnbellegi />;
      case 'puanlar': return <MuezzinPuanlari />;
      case 'mazeret': return <MazeretGecmisi />;
      case 'izinler': return <IzinYonetimi />;
      case 'duyurular': return <DuyuruYonetimi />;
      default: return null;
    }
  };

  const navGroups = [
    {
      title: 'OPERASYONEL YÖNETİM',
      items: [
        { id: 'cizelge', label: 'HİZMET CETVELİ', icon: <CalendarDays size={20} />, subtext: 'Haftalık Plan', bg: 'bg-indigo-600', text: 'text-white' },
        { id: 'alarmlar', label: 'VAKİT ALARMLARI', icon: <Bell size={20} />, badge: cozulmamisSayisi, subtext: `${cozulmamisSayisi} Aktif Kriz`, bg: 'bg-rose-600', text: 'text-white' },
        { id: 'duyurular', label: 'DUYURU YÖNETİMİ', icon: <Megaphone size={20} />, subtext: `${activeDuyurular} Aktif Kayıt`, bg: 'bg-indigo-600', text: 'text-white' },
      ]
    },
    {
      title: 'PERSONEL & PERFORMANS',
      items: [
        { id: 'muezzinler', label: 'KADRO YÖNETİMİ', icon: <Users size={20} />, subtext: `${muezzinler.length} Görevli`, bg: 'bg-slate-900', text: 'text-white' },
        { id: 'izinler', label: 'İZİN YÖNETİMİ', icon: <CalendarDays size={20} />, badge: pendingIzinler, subtext: `${pendingIzinler} Onay Bekleyen`, bg: 'bg-emerald-600', text: 'text-white' },
        { id: 'mazeret', label: 'MAZERET KAYITLARI', icon: <History size={20} />, bg: 'bg-slate-900', text: 'text-white' },
        { id: 'puanlar', label: 'PERFORMANS ARŞİVİ', icon: <Award size={20} />, bg: 'bg-slate-900', text: 'text-white' },
      ]
    },
    {
      title: 'SİSTEM AYARLARI',
      items: [
        { id: 'onbellek', label: 'SİSTEM & VERİ HUB', icon: <Database size={20} />, subtext: 'API & Senkron', bg: 'bg-slate-900', text: 'text-white' },
      ]
    }
  ];

  const allNavItems = navGroups.flatMap(g => g.items);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Minimal Sidebar - Desktop */}
      <aside className="w-[300px] bg-white border-r border-slate-200 flex-shrink-0 flex flex-col fixed inset-y-0 hidden lg:flex z-50">
        <div className="p-10 flex items-center gap-4 border-b border-slate-100">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
            <LayoutDashboard size={22} className="relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent transition-opacity group-hover:opacity-100 opacity-50" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-slate-900 tracking-tighter leading-none">İLÇE MÜFTÜLÜĞÜ</h1>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-500 mt-1.5 flex items-center gap-1.5">
               <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
               OPERASYON MERKEZİ
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 scrollbar-hide">
          <button
            onClick={() => setActiveTab(null)}
            className={`w-full flex items-center px-6 py-4 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${
              activeTab === null 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard size={16} className="mr-3" />
            GENEL BAKIŞ
          </button>
          
          {navGroups.map(group => (
            <div key={group.title} className="space-y-2">
              <p className="px-6 text-[9px] font-bold uppercase text-slate-400 tracking-[0.2em] mb-4">{group.title}</p>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center px-5 py-3 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all group ${
                    activeTab === item.id 
                      ? `${item.bg} ${item.text} shadow-lg shadow-slate-900/20` 
                      : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-100'
                  }`}
                >
                  <div className={`mr-4 p-2 rounded-lg transition-all ${activeTab === item.id ? 'bg-white/20' : 'bg-slate-50 group-hover:bg-white'}`}>
                    {React.cloneElement(item.icon as React.ReactElement, { size: 14, className: activeTab === item.id ? 'text-white' : 'text-slate-500' })}
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`ml-auto px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                      activeTab === item.id ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-100 space-y-4">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
             <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">SİSTEM SAATİ</span>
                <div className="text-slate-900 font-bold text-sm tracking-tight mt-0.5 font-mono">
                   <LiveClockDisplay />
                </div>
             </div>
             <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                <Clock size={16} />
             </div>
          </div>
          
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 p-4 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-rose-600 transition-all shadow-sm"
          >
             PANELDEN AYRIL
          </button>
        </div>
      </aside>

      {/* Mobile Header / Navigation */}
      <div className="lg:hidden bg-slate-900 text-white p-6 sticky top-0 z-[60] flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight leading-none italic uppercase">Hizmet<span className="text-indigo-400">Core</span></h1>
            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1">Admin Merkezi</p>
          </div>
        </div>
        
        {activeTab ? (
          <button 
            onClick={() => setActiveTab(null)}
            className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white active:scale-95 transition-all"
          >
            <ArrowRight size={18} className="rotate-180" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-widest text-white/50">Online</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className={`flex-1 lg:ml-[300px] p-0 md:p-10 lg:p-16 pb-32`}>
        <AnimatePresence mode="wait">
          {!activeTab ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="max-w-6xl mx-auto px-4 md:px-0 pt-8 md:pt-0"
            >
              <header className="mb-16 relative">
                 <div className="flex items-center gap-3 mb-4">
                  <div className="px-4 py-2 bg-slate-900 text-white rounded-full flex items-center gap-2 shadow-lg shadow-slate-900/10 border border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">MERKEZİ SİSTEM AKTİF</span>
                  </div>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4 lowercase italic">
                   ADMIN<span className="text-indigo-600 italic">CORE</span>
                </h1>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">KURUMSAL HİZMET VE KOORDİNASYON MERKEZİ</p>
              </header>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                 {/* Efficiency Card */}
                 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-6">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <TrendingUp size={20} />
                       </div>
                       <span className="text-emerald-500 text-[10px] font-black tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">+2.1%</span>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">SİSTEM VERİMLİLİĞİ</p>
                       <p className="text-3xl font-black text-slate-900 tracking-tighter">98.4%</p>
                    </div>
                 </div>

                 {/* Alarms Card */}
                 <div className={`bg-white rounded-3xl border shadow-sm p-6 flex flex-col justify-between group hover:border-rose-200 transition-all ${cozulmamisSayisi > 0 ? 'border-rose-100 ring-4 ring-rose-50' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-6">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner transition-all ${
                          cozulmamisSayisi > 0 ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-rose-50 group-hover:text-rose-600'
                       }`}>
                          <AlertCircle size={20} />
                       </div>
                       {cozulmamisSayisi > 0 && (
                          <span className="text-white text-[10px] font-black tracking-widest bg-rose-600 px-2 py-1 rounded-lg animate-pulse">ACİL</span>
                       )}
                    </div>
                    <div>
                       <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1 ${cozulmamisSayisi > 0 ? 'text-rose-500' : 'text-slate-400'}`}>BEKLEYEN MÜDAHALE</p>
                       <p className={`text-3xl font-black tracking-tighter ${cozulmamisSayisi > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {String(cozulmamisSayisi).padStart(2, '0')}
                       </p>
                    </div>
                 </div>

                 {/* Staff Card */}
                 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between group hover:border-slate-300 transition-all">
                    <div className="flex justify-between items-start mb-6">
                       <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center border border-slate-800 shadow-inner transition-all">
                          <Users size={20} />
                       </div>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">GÖREVLİ KADROSU</p>
                       <p className="text-3xl font-black text-slate-900 tracking-tighter">{String(muezzinler.length).padStart(2, '0')}</p>
                    </div>
                 </div>

                 {/* Pending Actions Card */}
                 <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between group hover:border-emerald-200 transition-all">
                    <div className="flex justify-between items-start mb-6">
                       <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all">
                          <Clock size={20} />
                       </div>
                       {pendingIzinler > 0 && (
                          <span className="text-emerald-700 text-[10px] font-black tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">+{pendingIzinler}</span>
                       )}
                    </div>
                    <div>
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">BEKLEYEN ONAYLAR</p>
                       <p className="text-3xl font-black text-slate-900 tracking-tighter">
                          {String(pendingIzinler).padStart(2, '0')}
                       </p>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-4 mb-8">
                 <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-50">YÖNETİM MODÜLLERİ</h2>
                 <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {allNavItems.map((item, idx) => (
                  <motion.button
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(item.id)}
                    className="relative p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-start group overflow-hidden transition-all hover:border-indigo-300 hover:shadow-md min-h-[120px]"
                  >
                    <div className="relative z-10 w-full">
                       <div className="flex justify-between items-start mb-4">
                         <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm border border-slate-100 group-hover:border-indigo-500">
                            {React.cloneElement(item.icon as React.ReactElement, { size: 16 })}
                         </div>
                         {(item as any).badge !== undefined && (item as any).badge > 0 && (
                           <div className="px-2 py-1 bg-rose-500 text-white rounded-lg text-[9px] font-bold tracking-widest shadow-sm">
                               AKTİF
                           </div>
                         )}
                       </div>
                       <h3 className="font-bold text-slate-800 text-[11px] tracking-wide uppercase truncate w-full text-left">{item.label}</h3>
                       <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1.5 group-hover:text-indigo-500 transition-colors">
                         {(item as any).subtext || 'Yönet'}
                       </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto"
            >
              {/* Module Header Container */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 px-4 md:px-0">
                <div className="flex items-center gap-4">
                  <div>
                     <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none lowercase italic">
                        {allNavItems.find(i => i.id === activeTab)?.label.toLowerCase()}
                     </h2>
                     <div className="text-[9px] uppercase font-bold text-slate-400 tracking-[0.3em] mt-3 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        GÜVENLİ YÖNETİM MODÜLÜ
                     </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {activeTab === 'alarmlar' && cozulmamisSayisi > 0 && (
                    <div className="px-6 py-4 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-600/20 font-bold text-[10px] uppercase tracking-widest animate-pulse">
                        {cozulmamisSayisi} AKTİF KRİZ MEVCUT
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setActiveTab(null)}
                    className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all text-[10px] font-bold uppercase tracking-widest group shadow-sm"
                  >
                    <ArrowRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    <span>DÖNÜŞ</span>
                  </button>
                </div>
              </div>
              
              <div className="bg-white/40 backdrop-blur-3xl rounded-3xl border border-slate-200/60 p-4 sm:p-10 lg:p-16 min-h-[700px] shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  {renderContent()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


      </main>
    </div>
  );
}
