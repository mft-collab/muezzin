import { 
 GoogleAuthProvider, 
 signInWithPopup, 
 signInWithRedirect, 
 getRedirectResult
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { isFirebaseSdkError } from '../lib/firestore-errors';
import { unregisterFcmToken } from '../hooks/useFcmToken';
import { useState, useEffect } from 'react';
import React from 'react';
import { SplashLoader } from './SplashLoader';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { LoginScreen } from './auth/LoginScreen';
import { AuthErrorScreen } from './auth/AuthErrorScreen';
import { PendingApprovalScreen } from './auth/PendingApprovalScreen';

export function AuthGuard({ children }: { children: React.ReactNode }) {
 const user = useAuthStore(state => state.user);
 const loading = useAuthStore(state => state.loading);
 const isPending = useAuthStore(state => state.isPending);
 const error = useAuthStore(state => state.error);
 const isAdmin = useAuthStore(state => state.isAdmin);
 const setError = useAuthStore(state => state.setError);
 const setLoading = useAuthStore(state => state.setLoading);
 
 const [isLoginInProgress, setIsLoginInProgress] = useState(false);
 const [loadingTimeout, setLoadingTimeout] = useState(false);
 const [isOffline, setIsOffline] = useState(!navigator.onLine);

 // Initialize Auth Store on mount to activate Firebase Auth listeners
 // Note: We do not unsubscribe the listener on unmount because the Auth store
 // is a global singleton, preventing React 18's StrictMode double-mounting in dev
 // from permanently cancelling the active Firebase Auth listeners.
 useEffect(() => {
 useAuthStore.getState().init();
 }, []);

  useEffect(() => {
    const checkRedirect = async () => {
      const isRedirectPending = sessionStorage.getItem('muezzin:auth_redirect_pending') === 'true';
      if (!isRedirectPending) return;

      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          // Redirect login successful
        }
      } catch (err: unknown) {
        if (isFirebaseSdkError(err) && err.code === 'auth/unauthorized-domain') {
          setError('Bu alan adı (domain) henüz Firebase panelinde yetkilendirilmemiş. Lütfen yöneticiye başvurun.');
        } else {
          setError('Giriş yapılırken bir sorun oluştu. Lütfen tekrar deneyin.');
        }
      } finally {
        sessionStorage.removeItem('muezzin:auth_redirect_pending');
      }
    };
    checkRedirect();
  }, [setError]);

 useEffect(() => {
 const handleOnline = () => setIsOffline(false);
 const handleOffline = () => setIsOffline(true);
 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);
 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, []);

 useEffect(() => {
 const timer = setTimeout(() => {
 if (loading) {
 setLoadingTimeout(true);
 }
 }, 4000); // 4 seconds is enough for a smooth splash, then we show retry/continue
 return () => clearTimeout(timer);
 }, [loading]);

 const logout = async () => {
 try {
 // Push aboneliğini ve Firestore'daki bu cihaza ait fcmTokens girdisini
 // signOut'tan ÖNCE temizle — kendi profilini güncelleme izni yalnızca
 // oturum açıkken var (bkz. unregisterFcmToken yorumu, mimari denetim).
 await unregisterFcmToken(auth.currentUser?.uid);
 await auth.signOut();
 window.location.reload(); // Hard reset on logout
 } catch (err) {
 }
 };

 const login = async () => {
 if (isLoginInProgress) return;
 setIsLoginInProgress(true);
 setError(null);

 try {
 const provider = new GoogleAuthProvider();
 provider.setCustomParameters({ 
 prompt: 'select_account'
 });
 
 // Try popup first (faster experience)
 try {
 await signInWithPopup(auth, provider);
 } catch (popupErr: unknown) {
  // If popup is blocked or fails, fallback to redirect
  if (isFirebaseSdkError(popupErr) && (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request')) {
    sessionStorage.setItem('muezzin:auth_redirect_pending', 'true');
    await signInWithRedirect(auth, provider);
  } else {
    throw popupErr;
  }
 }
 } catch (e: unknown) {
 if (isFirebaseSdkError(e) && e.code === 'auth/unauthorized-domain') {
 setError('Bu alan adı (domain) yetkilendirilmemiş. Lütfen localhost veya kayıtlı alan adını kullanın.');
 } else if (!isFirebaseSdkError(e) || e.code !== 'auth/popup-closed-by-user') {
 setError('Giriş yapılamadı. Lütfen internet bağlantınızı ve Google hesabınızı kontrol edin.');
 }
 } finally {
 setIsLoginInProgress(false);
 }
 };

  return (
    <>
      <AnimatePresence mode="popLayout">
        {loading && (
          <motion.div
            key="splash-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96, filter: 'blur(15px)' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[var(--app-bg)] text-center p-6"
          >
            <SplashLoader />
            {loadingTimeout && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 spatial-glass p-6 max-w-sm border-amber-500/20 z-[10000] relative pointer-events-auto"
              >
                <p className="text-amber-500 text-xs font-medium mb-4">
                  Bağlantı beklenenden yavaş sürüyor...
                </p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => window.location.reload()} 
                    className="text-2xs uppercase tracking-wide text-[var(--dynamic-aura,var(--aura-indigo))] font-bold hover:text-[var(--dynamic-aura,var(--aura-indigo))] transition-colors cursor-pointer border-none bg-transparent"
                  >
                    SAYFAYI YENİLE
                  </button>
                  <button 
                    onClick={() => { setLoading(false); setLoadingTimeout(false); }} 
                    className="text-2xs uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer border-none bg-transparent"
                  >
                    Giriş Ekranına Devam Et
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && (
        <motion.div
          key="auth-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full min-h-screen"
        >
          {error ? (
            <AuthErrorScreen 
              error={error} 
              setError={setError} 
              setLoading={setLoading} 
              logout={logout} 
            />
          ) : isPending ? (
            <PendingApprovalScreen logout={logout} />
          ) : !user ? (
            <LoginScreen login={login} isLoginInProgress={isLoginInProgress} />
          ) : (
            children
          )}
        </motion.div>
      )}
    </>
  );
}
