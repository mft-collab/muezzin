import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User, LogOut, Calendar, Edit3, Shield, CheckCircle2, Award, Clock, X, History, Smartphone, MapPin, ChevronRight, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

import { useIzinler } from '../hooks/useIzinler';
import { Vakit, Izin } from '../types';
import { getTurkeyDateString, GUNLER_TR } from '../lib/dateUtils';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Coffee, CalendarDays } from 'lucide-react';

export default function Profil() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

  const { izinler, izinTalepEt, loading: izinLoading, izinSil } = useIzinler();
  const today = getTurkeyDateString();
  const isCurrentlyOnLeave = izinler.some(izin => izin.durum === 'onaylandi' && today >= izin.baslangic && today <= izin.bitis);

  const [showIzinForm, setShowIzinForm] = useState(false);
  const [izinForm, setIzinForm] = useState({
    baslangic: format(new Date(), 'yyyy-MM-dd'),
    bitis: format(new Date(), 'yyyy-MM-dd'),
    tip: 'haftalik' as const,
    sebep: ''
  });

  const handleIzinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!izinForm.sebep.trim()) {
        alert("Lütfen bir gerekçe belirtiniz.");
        return;
      }
      await izinTalepEt(izinForm);
      setShowIzinForm(false);
      setIzinForm({
        baslangic: format(new Date(), 'yyyy-MM-dd'),
        bitis: format(new Date(), 'yyyy-MM-dd'),
        tip: 'haftalik',
        sebep: ''
      });
    } catch (err) {
      alert("Talebiniz iletilemedi. Lütfen tüm alanları kontrol edin.");
    }
  };

  useEffect(() => {
    if (auth.currentUser) {
      setLoading(true);
      const fetchData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'muezzins', auth.currentUser!.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setNewName(data.displayName || '');
          }
        } catch (err) {
          console.error("Profil verisi çekilemedi:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, []);

  const handleUpdate = async () => {
    if (!auth.currentUser || !newName.trim()) return;
    try {
      await updateDoc(doc(db, 'muezzins', auth.currentUser.uid), { 
        displayName: newName.trim()
      });
      setUserData({ ...userData, displayName: newName.trim() });
      setEditMode(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.reload();
    } catch (err) {
      console.error("Çıkış yapılamadı:", err);
    }
  };

  const isAdmin = userData?.role === 'admin';

  const menuItems = [
    { icon: <MapPin size={16} />, label: 'Görev Yeri', value: 'Merkez Camii (Ceyhan)', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { icon: <History size={16} />, label: 'Son Hizmet Cetveli', value: 'Geçen Hafta', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: <Smartphone size={16} />, label: 'Bağlı Cihaz', value: 'iPhone 14 (Aktif)', color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 pb-40">
      <div className="max-w-xl mx-auto px-6 pt-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin h-10 w-10 border-4 border-blue-100 border-t-blue-600 rounded-full" />
            <p className="text-[10px] font-bold text-blue-900/30 uppercase tracking-widest">Profil Senkronize Ediliyor</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header: Pro Profile Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden p-6 bg-slate-900 rounded-3xl text-white shadow-xl shadow-slate-900/20"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/10 rounded-full -ml-24 -mb-24 blur-3xl opacity-30" />
              
              <div className="relative z-10 flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 flex items-center justify-center text-4xl font-black shadow-inner group overflow-hidden">
                    <span className="group-hover:scale-110 transition-transform duration-500">{userData?.displayName?.charAt(0) || 'U'}</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 via-indigo-500/0 to-indigo-400/20" />
                  </div>
                  {userData?.aktif && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-500 border-[2px] border-slate-900 flex items-center justify-center">
                       <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="w-full">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    {editMode ? (
                      <input 
                        type="text" 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)}
                        className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-xl font-bold outline-none focus:ring-2 focus:ring-indigo-400 text-center w-full max-w-xs"
                        autoFocus
                      />
                    ) : (
                      <h3 className="text-2xl font-black truncate tracking-tighter leading-tight">{userData?.displayName}</h3>
                    )}
                    <button 
                      onClick={() => editMode ? handleUpdate() : setEditMode(true)}
                      className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/15 rounded-xl transition-all shrink-0"
                    >
                      {editMode ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Edit3 size={14} className="text-white/40" />}
                    </button>
                  </div>
                  <div className="text-[9px] text-white/50 font-semibold tracking-wider uppercase">
                    ID: {auth.currentUser?.uid.slice(0, 8)} • {userData?.email || auth.currentUser?.email}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className={`px-3 py-1.5 rounded-xl text-[8px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isAdmin ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'}`}>
                    {isAdmin ? <Shield size={10} /> : <User size={10} />}
                    {isAdmin ? 'SİSTEM YÖNETİCİSİ' : 'ASMA GÖREVLİ'}
                  </div>
                  {isCurrentlyOnLeave && (
                    <div className="px-3 py-1.5 rounded-xl text-[8px] font-bold uppercase tracking-widest bg-amber-500 text-white flex items-center gap-1.5">
                      <Coffee size={10} />
                      ŞUAN İZİNLİ
                    </div>
                  )}
                  {userData?.haftalikIzinGunu && userData.haftalikIzinGunu > 0 && (
                    <div className="px-3 py-1.5 rounded-xl text-[8px] font-bold uppercase tracking-widest bg-emerald-600 text-white flex items-center gap-1.5">
                      <CalendarDays size={10} />
                      SABİT: {GUNLER_TR[userData.haftalikIzinGunu].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Performance Matrix Bento Grid */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                whileHover={{ y: -2, scale: 1.02 }}
                className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center text-center gap-3 group"
              >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-transform group-hover:rotate-12 duration-500 border border-indigo-100">
                    <TrendingUp size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Aylık Vakit</p>
                    <div className="flex items-baseline gap-1 justify-center">
                      <span className="text-2xl font-black text-slate-800 tracking-tight">{userData?.aylikVakitSayisi || 0}</span>
                    </div>
                  </div>
              </motion.div>
              
              <motion.div 
                whileHover={{ y: -2, scale: 1.02 }}
                className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center text-center gap-3 group"
              >
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center transition-transform group-hover:-rotate-12 duration-500 border border-amber-100">
                    <Award size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Liyakat Puanı</p>
                    <div className="flex items-baseline gap-1 justify-center">
                      <span className="text-2xl font-black text-slate-800 tracking-tight">{userData?.puan || 0}</span>
                    </div>
                  </div>
              </motion.div>
            </div>

            {/* Section: Leave Management System */}
            <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                  <div className="space-y-0.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">İzin Yönetimi</h4>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">Talep ve Geçmiş</p>
                  </div>
                  {!showIzinForm && (
                     <button 
                       onClick={() => setShowIzinForm(true)}
                       className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest shadow-sm hover:bg-slate-800 transition-all"
                     >
                       YENİ TALEP
                     </button>
                  )}
               </div>

               {showIzinForm ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6"
                  >
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 ml-1">BAŞLANGIÇ</label>
                              <input 
                                type="date" 
                                value={izinForm.baslangic}
                                onChange={e => setIzinForm({...izinForm, baslangic: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-300 transition-all"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 ml-1">BİTİŞ</label>
                              <input 
                                type="date" 
                                value={izinForm.bitis}
                                onChange={e => setIzinForm({...izinForm, bitis: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-300 transition-all"
                              />
                           </div>
                        </div>

                        <div className="space-y-1.5">
                           <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 ml-1">TÜR GEREKÇE</label>
                           <div className="grid grid-cols-3 gap-2">
                              {(['haftalik', 'yillik', 'mazeret'] as const).map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setIzinForm({...izinForm, tip: type})}
                                  className={`py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border ${
                                    izinForm.tip === type 
                                      ? 'bg-slate-900 border-slate-900 text-white' 
                                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                  }`}
                                >
                                  {type === 'yillik' ? 'Yıllık' : type === 'haftalik' ? 'Haftalık' : 'Mazeret'}
                                </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-1.5">
                           <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 ml-1">AÇIKLAMA</label>
                           <textarea 
                             placeholder="Zorunlu bir mazeret veya gerekçe belirtiniz..."
                             value={izinForm.sebep}
                             onChange={e => setIzinForm({...izinForm, sebep: e.target.value})}
                             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-300 min-h-[80px] resize-none transition-all"
                           />
                        </div>
                     </div>

                     <div className="flex gap-3">
                        <button 
                          onClick={() => setShowIzinForm(false)}
                          className="flex-1 py-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-transparent"
                        >
                          VAZGEÇ
                        </button>
                        <button 
                          onClick={handleIzinSubmit}
                          className="flex-[2] py-3 bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-xl shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
                        >
                          TALEBİ GÖNDER
                        </button>
                     </div>
                  </motion.div>
               ) : (
                  <div className="space-y-2">
                     {izinler.length === 0 ? (
                        <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center shadow-sm">
                           <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Calendar size={24} className="text-slate-300" />
                           </div>
                           <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest italic">Kayıt bulunamadı</p>
                        </div>
                     ) : (
                        <div className="space-y-2">
                          {izinler.slice(0, 4).map((izin) => (
                             <motion.div 
                               key={izin.id}
                               whileHover={{ x: 4 }}
                               className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm group transition-all"
                             >
                                <div className="flex items-center gap-4">
                                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                     izin.durum === 'onay_bekliyor' ? 'bg-amber-50 text-amber-500' : 
                                     izin.durum === 'onaylandi' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                                   }`}>
                                      {izin.durum === 'onaylandi' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                                   </div>
                                   <div className="flex flex-col">
                                      <p className="text-sm font-bold text-slate-800 tracking-tight">
                                         {format(parseISO(izin.baslangic), 'd MMM', { locale: tr })} - {format(parseISO(izin.bitis), 'd MMM', { locale: tr })}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                           {izin.tip === 'yillik' ? 'Yıllık' : izin.tip === 'haftalik' ? 'Haftalık' : 'Mazeret'}
                                        </span>
                                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                                        <span className={`text-[9px] font-bold uppercase tracking-widest ${
                                          izin.durum === 'onay_bekliyor' ? 'text-amber-500' : izin.durum === 'onaylandi' ? 'text-emerald-500' : 'text-rose-500'
                                        }`}>
                                           {izin.durum === 'onay_bekliyor' ? 'Bekliyor' : izin.durum === 'onaylandi' ? 'Onaylandı' : 'Reddedildi'}
                                        </span>
                                      </div>
                                   </div>
                                </div>
                                {izin.durum === 'onay_bekliyor' && (
                                   <button 
                                     onClick={() => izinSil(izin.id!)}
                                     className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                                   >
                                      <X size={16} />
                                   </button>
                                )}
                             </motion.div>
                          ))}
                          {izinler.length > 4 && (
                            <button className="w-full py-3 text-[9px] font-bold text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-xl transition-all">TÜM GEÇMİŞ</button>
                          )}
                        </div>
                     )}
                  </div>
               )}
            </div>

            {/* Quick Glance Info Cards */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm divide-y divide-slate-50">
              {menuItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-5 first:pt-0 last:pb-0 group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl ${item.bg} ${item.color} flex items-center justify-center transition-transform group-hover:scale-105`}>
                      {React.cloneElement(item.icon as React.ReactElement, { size: 14 })}
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{item.value}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
              ))}
            </div>

            {/* Logout Section */}
            <div className="space-y-4 pt-6">
              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout} 
                className="w-full py-4 flex items-center justify-center gap-3 bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-sm group"
              >
                <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" /> 
                GÜVENLİ ÇIKIŞ
              </motion.button>
              
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-3">
                   <div className="h-px w-8 bg-slate-200" />
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">VERSION 2.0.0 PREMIUM</p>
                   <div className="h-px w-8 bg-slate-200" />
                </div>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed max-w-[280px] mx-auto opacity-60">
                  Bu uygulama Müftülük Mihrap ve Hizmet koordinasyonu için özel olarak optimize edilmiştir.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
