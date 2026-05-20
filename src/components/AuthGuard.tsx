import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useState, useEffect } from 'react';
import React from 'react';
import { SplashLoader } from './SplashLoader';
import { motion } from 'motion/react';
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
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
           // Redirect login successful
        }
      } catch (err: any) {
        if (err.code === 'auth/unauthorized-domain') {
          setError('Bu alan adı (domain) henüz Firebase panelinde yetkilendirilmemiş. Lütfen yöneticiye başvurun.');
        } else {
          setError('Giriş yapılırken bir sorun oluştu. Lütfen tekrar deneyin.');
        }
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
      } catch (popupErr: any) {
        // If popup is blocked or fails, fallback to redirect
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
          await signInWithRedirect(auth, provider);
        } else {
          throw popupErr;
        }
      }
    } catch (e: any) { 
      if (e.code === 'auth/unauthorized-domain') {
        setError('Bu alan adı (domain) yetkilendirilmemiş. Lütfen localhost veya kayıtlı alan adını kullanın.');
      } else if (e.code !== 'auth/popup-closed-by-user') {
        setError('Giriş yapılamadı. Lütfen internet bağlantınızı ve Google hesabınızı kontrol edin.');
      }
    } finally {
      setIsLoginInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--app-bg)] text-center p-6">
        <SplashLoader />
        {loadingTimeout && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 spatial-glass p-6 max-w-sm border-amber-500/20"
          >
            <p className="text-amber-500 text-xs font-medium mb-4">
              Bağlantı beklenenden yavaş sürüyor...
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => window.location.reload()} 
                className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
              >
                SAYFAYI YENİLE
              </button>
              <button 
                onClick={() => { setLoading(false); setLoadingTimeout(false); }} 
                className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Giriş Ekranına Devam Et
              </button>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <AuthErrorScreen 
        error={error} 
        setError={setError} 
        setLoading={setLoading} 
        logout={logout} 
      />
    );
  }

  if (isPending) return <PendingApprovalScreen logout={logout} />;

  if (!user) return <LoginScreen login={login} isLoginInProgress={isLoginInProgress} />;

  return <>{children}</>;
}
