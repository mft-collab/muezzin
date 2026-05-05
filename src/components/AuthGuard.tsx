import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useState, useEffect } from 'react';
import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { SplashLoader } from './SplashLoader';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("AuthGuard: SDK initialization timeout reached.");
        setLoadingTimeout(true);
      }
    }, 20000); // 20s
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;

      try {
        if (currentUser) {
          const userDocRef = doc(db, 'muezzins', currentUser.uid);
          
          let userDoc;
          try {
            // First attempt: try cache/server naturally
            userDoc = await getDoc(userDocRef);
          } catch (e: any) {
            console.error("AuthGuard: Initial getDoc profile failed", e);
            
            // If it's a network/offline error, try to proceed if we have ANY data (even if we just wait)
            // But if we're here, getDoc failed.
            if (e.message?.includes('offline')) {
               setError("İnternet bağlantısı kurulamadı. Lütfen ağınızı kontrol edin.");
               return;
            }
            
            if (e.code === 'permission-denied') {
              // Forced refresh and server fetch
              await currentUser.getIdToken(true);
              userDoc = await getDocFromServer(userDocRef);
            } else {
              throw handleFirestoreError(e, OperationType.GET, `muezzins/${currentUser.uid}`);
            }
          }

          if (!userDoc.exists()) {
            const currentEmail = currentUser.email?.toLowerCase().trim() || '';
            const isAdminEmail = currentEmail === 'muftum@gmail.com';
            
            let inviteData = null;
            if (isAdminEmail) {
              inviteData = { role: "admin", displayName: "Yönetici" };
            } else if (currentEmail) {
              const inviteRef = doc(db, 'invites', currentEmail);
              try {
                const inviteDoc = await getDocFromServer(inviteRef); // Use server to be sure
                if (inviteDoc.exists()) {
                  inviteData = inviteDoc.data();
                } else {
                  throw new Error(`Sistemde kaydınız bulunamadı. Lütfen yöneticiye e-postanızı (${currentEmail}) bildirin.`);
                }
              } catch (inviteErr: any) {
                if (inviteErr.message?.includes('offline')) {
                  throw new Error("Kayıt doğrulaması için internet bağlantısı gerekiyor. Lütfen bağlantınızı kontrol edin.");
                }
                if (inviteErr.code === 'permission-denied') {
                  throw new Error(`Erişim yetkiniz doğrulanırken hata oluştu. Lütfen yöneticinizden e-postanızın (${currentEmail}) doğru kaydedildiğini teyit edin.`);
                }
                throw handleFirestoreError(inviteErr, OperationType.GET, `invites/${currentEmail}`);
              }
            }

            // Create profile carefully
            try {
              const profileData = {
                displayName: inviteData?.displayName || currentUser.displayName || currentEmail.split('@')[0],
                aktif: true,
                aylikVakitSayisi: 0,
                role: isAdminEmail ? "admin" : (inviteData?.role || "muezzin"),
                fcmToken: "",
                photoURL: currentUser.photoURL || "",
                onayBekliyor: false,
                email: currentUser.email || "",
                kayitTarihi: new Date().toISOString()
              };
              
              await setDoc(userDocRef, profileData);
              
              // Success creation, try to clean up invite
              if (inviteData && !isAdminEmail) {
                try {
                  await deleteDoc(doc(db, 'invites', currentEmail));
                } catch (delErr: any) {
                  console.warn("AuthGuard: Invite cleanup failed (non-critical)", delErr.message);
                }
              }
              
              setUser(currentUser);
              setIsPending(false);
            } catch (createErr: any) {
              console.error("AuthGuard: Profile creation Error Details:", {
                code: createErr.code,
                message: createErr.message,
                uid: currentUser.uid,
                email: currentEmail
              });
              if (createErr.code === 'permission-denied') {
                throw new Error(`Profil oluşturulamadı (Erişim Yetki Hatası). Sistemsel kısıtlama mevcut. Lütfen sayfayı yenileyip tekrar deneyin veya yöneticiye başvurun.`);
              }
              throw handleFirestoreError(createErr, OperationType.WRITE, `muezzins/${currentUser.uid}`);
            }
          } else {
            // Document exists, check contents
            const data = userDoc.data();
            const currentEmail = currentUser.email?.toLowerCase().trim() || '';
            const isAdminEmail = currentEmail === 'muftum@gmail.com';

            if (isAdminEmail && (data?.role !== 'admin' || data?.onayBekliyor)) {
              await setDoc(userDocRef, { role: 'admin', onayBekliyor: false, aktif: true }, { merge: true });
              setIsPending(false);
            } else {
              if (data?.aktif === false) throw new Error("Hesabınız devre dışı bırakılmış.");
              setIsPending(!!data?.onayBekliyor);
            }
            setUser(currentUser);
          }
        } else {
          setUser(null);
          setIsPending(false);
        }
      } catch (err: any) {
        setError(err.message || "Sisteme giriş yapılamadı.");
        setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);


  const logout = async () => {
    try {
      await auth.signOut();
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const login = async () => {
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ 
        prompt: 'select_account',
        display: 'popup'
      });
      await signInWithPopup(auth, provider);
    } catch (e: any) { 
      console.error("Login hatası:", e);
      let errorMsg = e.message;
      if (e.code === 'auth/popup-blocked') {
        errorMsg = "Giriş penceresi tarayıcı tarafından engellendi. Lütfen pop-up'lara izin verin.";
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMsg = "Bu site henüz yetkilendirilmemiş. Yöneticiye başvurun.";
      }
      setError(errorMsg); 
      setLoading(false);
    }
  };

  if (loading) {
    if (loadingTimeout) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7] text-center p-6">
          <AlertCircle size={48} className="text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Bağlantı Sorunu</h2>
          <p className="text-gray-500 mt-2 max-w-sm">Sunucu ile bağlantı kurulamıyor. Lütfen sayfayı yenileyin.</p>
          <button onClick={() => window.location.reload()} className="mt-8 h-12 px-8 bg-blue-600 text-white rounded-2xl font-medium shadow-lg shadow-blue-600/20 active:scale-95 transition-all">SAYFAYI YENİLE</button>
        </div>
      );
    }
    return <SplashLoader />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[32px] shadow-2xl p-10 text-center border border-white"
        >
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 tracking-tight">Giriş Yapılamadı</h2>
          <div className="bg-red-50/50 p-4 rounded-2xl mb-8 text-left border border-red-50">
            <p className="text-sm text-red-700 leading-relaxed font-medium">{error}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => { setError(null); setLoading(false); }}
              className="w-full h-14 bg-blue-600 text-white rounded-2xl font-medium shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
            >
              TEKRAR DENE
            </button>
            <button
              onClick={logout}
              className="w-full h-14 bg-gray-100 text-gray-600 rounded-2xl font-medium hover:bg-gray-200 transition-all active:scale-95"
            >
              BAŞKA HESAP KULLAN
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isPending) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7] p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[40px] shadow-2xl max-w-md w-full text-center border border-white"
      >
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Clock size={36} />
        </div>
        <h1 className="text-2xl font-semibold mb-3 text-blue-950 tracking-tight">Onay Bekleniyor</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Sisteme kaydınız yapıldı fakat hesabınız henüz yönetici tarafından aktif edilmedi.
        </p>
        <div className="bg-blue-50/50 p-5 rounded-2xl text-xs text-blue-800 mb-10 text-left border border-blue-100/50 space-y-1">
          <div className="flex justify-between border-b border-blue-100 pb-1 mb-1">
            <span className="opacity-50">Ad Soyad:</span>
            <span className="font-bold">{auth.currentUser?.displayName}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-50">E-posta:</span>
            <span className="font-bold">{auth.currentUser?.email}</span>
          </div>
        </div>
        <button 
          onClick={logout} 
          className="w-full h-12 text-gray-400 font-medium hover:text-red-500 transition-colors uppercase text-[10px] tracking-widest"
        >
          GİRİŞ YAPILAN HESAPTAN ÇIK
        </button>
      </motion.div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7] p-6 selection:bg-blue-100 selection:text-blue-900">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 lg:p-14 rounded-[48px] shadow-2xl shadow-blue-900/5 max-w-lg w-full text-center border border-white relative"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-blue-600/30 ring-8 ring-blue-50">
          <Clock size={40} />
        </div>

        <h1 className="text-4xl font-medium mb-4 text-blue-950 tracking-tighter leading-none uppercase">
          Müezzin <span className="text-blue-600 font-light">TAKİP</span>
        </h1>
        <p className="text-blue-900/40 mb-12 font-medium tracking-wide uppercase text-[10px] bg-blue-50 inline-block px-4 py-1.5 rounded-full">
           Ezan Nöbet Yönetim Sistemi • v2.0.0
        </p>
        
        <div className="flex flex-col gap-4 mb-10">
          <button 
            onClick={login} 
            className="w-full h-16 flex items-center justify-center gap-4 bg-blue-950 text-white rounded-[24px] font-medium text-sm shadow-xl shadow-blue-950/20 hover:bg-blue-900 hover:-translate-y-1 transition-all active:scale-95"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 grayscale brightness-100 invert" alt="Google" referrerPolicy="no-referrer" />
            SİSTEME GİRİŞ YAP
          </button>
        </div>

        <p className="text-[10px] text-blue-900/30 font-medium uppercase leading-relaxed tracking-wider">
           Kurumsal Giriş Gerekir. <br/> Yalnızca Yetkili Personel Erişim Sağlayabilir.
        </p>
        
        <div className="mt-12 flex items-center justify-center gap-4 text-[9px] font-medium text-blue-900/20 uppercase tracking-widest border-t border-blue-50/50 pt-8">
           <span>T.C. DİYANET İŞLERİ BAŞKANLIĞI</span>
           <span>•</span>
           <span>GÜVENLİ ERİŞİM</span>
        </div>
      </motion.div>
    </div>
  );
  return <>{children}</>;
}
