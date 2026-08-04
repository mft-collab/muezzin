import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BellRing, History } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { Muezzin } from '../types';
import { registerFcmToken } from '../hooks/useFcmToken';
import { useThemeStore } from '../store/useThemeStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { NotificationHistoryPanel } from './NotificationHistoryPanel';

interface NotificationSettingsProps {
  userData: Muezzin | null;
  user: FirebaseUser | null;
}

export default function NotificationSettings({ userData, user }: NotificationSettingsProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { theme, toggleTheme } = useThemeStore();
  const { ttsEnabled, setTtsEnabled } = useNotificationStore();

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setUiMessage('Bu tarayıcı anlık bildirim sistemini desteklemiyor.');
      return;
    }
    
    if (Notification.permission === 'denied') {
      setUiMessage('Bildirim izinleri tarayıcınızda engellenmiş. Adres çubuğunun solundaki kilit simgesinden manuel izin verin.');
      return;
    }

    setIsRequesting(true);
    try {
      await registerFcmToken(true);
      setUiMessage(null);
    } catch (err) {
      console.error('Bildirim izni istenirken hata:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestNotification = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setUiMessage('Bu tarayıcı bildirimleri desteklemiyor.');
      return;
    }
    if (Notification.permission === 'granted') {
      new Notification('Müezzin Hizmet Dizgesi', {
        body: 'Bu bir sistem tanı test bildirimidir. Bağlantınız başarıyla sağlandı!',
        icon: '/favicon.ico'
      });
      setUiMessage(null);
    } else {
      setUiMessage('Lütfen önce bildirim iznini verin.');
    }
  };

  const handleToggleSetting = async (key: 'nobetHatirlatici' | 'duyurular' | 'mazeretDurumu') => {
    if (!user || !userData) return;
    
    const currentSettings = userData.notificationSettings || {
      nobetHatirlatici: true,
      duyurular: true,
      mazeretDurumu: true
    };
    
    const newSettings = {
      ...currentSettings,
      [key]: !currentSettings[key]
    };
    
    try {
      await updateDoc(doc(db, 'muezzins', user.uid), {
        notificationSettings: newSettings
      });
    } catch (err) {
      console.error('Bildirim tercihleri güncellenemedi:', err);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="p-8 spatial-glass rounded-[40px] border-[var(--glass-border)] shadow-[var(--spatial-shadow)] relative overflow-hidden"
    >
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--dynamic-aura,var(--aura-indigo))] animate-pulse" />
          <h4 className="premium-label !text-2xs !opacity-70 tracking-wide">BİLDİRİM TERCİHLERİ VE TANI DİREKTİFİ</h4>
        </div>
        <span className="text-2xs font-bold text-[var(--dynamic-aura,var(--aura-indigo))] bg-[var(--dynamic-aura,var(--aura-indigo))]/10 px-4 py-1.5 rounded-full uppercase tracking-wide">
          {userData?.fcmToken ? 'BAĞLANTI AKTİF' : 'İZİN GEREKLİ'}
        </span>
      </div>

      {uiMessage && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-2xs font-medium leading-relaxed flex justify-between items-start gap-3">
          <span>{uiMessage}</span>
          <button onClick={() => setUiMessage(null)} aria-label="Kapat" className="shrink-0 opacity-50 hover:opacity-100 text-xs">✕</button>
        </div>
      )}

      <div className="mb-6 p-4 bg-[var(--text-primary)]/[0.02] border border-[var(--glass-border)] rounded-[20px] flex items-start gap-4 flex-col sm:flex-row">
        <div className={`p-2.5 rounded-xl flex items-center justify-center shrink-0 ${
          userData?.fcmToken 
            ? 'bg-[var(--status-success)]/10 text-[var(--status-success)]' 
            : typeof window !== 'undefined' && !('Notification' in window)
            ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]'
            : typeof window !== 'undefined' && Notification.permission === 'denied'
            ? 'bg-[var(--status-danger)]/10 text-[var(--status-danger)]'
            : 'bg-[var(--status-warning)]/10 text-[var(--status-warning)]'
        }`}>
          <BellRing size={16} />
        </div>
        <div className="space-y-1">
          <h5 className="text-2xs font-bold uppercase tracking-wider text-[var(--text-primary)]">SİSTEM DURUM TANI</h5>
          <p className="text-2xs text-[var(--text-secondary)]/50 leading-relaxed font-light">
            {userData?.fcmToken 
              ? 'Anlık bildirim alıcınız başarıyla Google sunucularına bağlandı ve bu cihaz yetkilendirildi.' 
              : typeof window !== 'undefined' && !('Notification' in window)
              ? 'Bu cihazın tarayıcısı Web-Push anlık bildirim sistemini desteklemiyor.'
              : typeof window !== 'undefined' && Notification.permission === 'denied'
              ? 'Tarayıcı bildirim izinleri kalıcı olarak engellenmiş. Lütfen adres çubuğundaki kilit simgesinden izin verin.'
              : 'İzin verilmemiş veya cihaz kaydı yok. Bildirimleri etkinleştirerek görev ve duyuru uyarılarını alabilirsiniz.'}
          </p>
          
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && (
            <motion.button
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTestNotification}
              className="mt-3 px-4 py-2 bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-2xs font-bold uppercase tracking-wider hover:bg-[var(--text-primary)]/5 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BellRing size={10} />
              TANI TEST BİLDİRİMİ GÖNDER
            </motion.button>
          )}
        </div>
      </div>

      {!userData?.fcmToken && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied' && (
        <motion.button
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRequestNotificationPermission}
          disabled={isRequesting}
          className={`w-full mb-6 py-4 rounded-2xl bg-[var(--dynamic-aura,var(--aura-indigo))] text-[var(--text-primary)] text-2xs font-bold uppercase tracking-wide shadow-lg flex items-center justify-center gap-3 ${isRequesting ? 'opacity-70 cursor-wait' : ''}`}
        >
          {isRequesting ? (
            <div className="w-4 h-4 border-2 border-[var(--text-primary)]/30 border-t-white rounded-full animate-spin" />
          ) : (
            <BellRing size={15} strokeWidth={2} />
          )}
          {isRequesting ? 'İSTEK GÖNDERİLİYOR...' : 'BİLDİRİMLERİ ETKİNLEŞTİR'}
        </motion.button>
      )}

      <div className="space-y-5">
        {(
          [
            {
              key: 'nobetHatirlatici',
              title: 'Nöbet & Vakit Hatırlatıcıları',
              desc: 'Adınıza atanan nöbet saatleri yaklaşırken anlık uyarı alırsınız.'
            },
            {
              key: 'duyurular',
              title: 'Resmi Tebliğler & Duyurular',
              desc: 'Yönetim tarafından yayınlanan resmi tebliğlerden anında haberdar olursunuz.'
            },
            {
              key: 'mazeretDurumu',
              title: 'Mazeret & İzin Talebi Güncellemeleri',
              desc: 'Gönderdiğiniz mazeret veya izin talebi onaylandığında anlık bildirim alırsınız.'
            }
          ] as const
        ).map((setting) => {
          const currentSettings = userData?.notificationSettings || {
            nobetHatirlatici: true,
            duyurular: true,
            mazeretDurumu: true
          };
          const isChecked = currentSettings[setting.key] !== false;

          return (
            <div key={setting.key} className="flex items-center justify-between gap-6 py-2">
              <div className="space-y-1">
                <h5 className="text-xs font-semibold text-[var(--text-primary)]">{setting.title}</h5>
                <p className="text-2xs text-[var(--text-secondary)]/75 leading-normal max-w-[280px] font-light">{setting.desc}</p>
              </div>
              <button
                onClick={() => handleToggleSetting(setting.key)}
                role="switch"
                aria-checked={isChecked}
                aria-label={setting.title}
                className={`w-12 h-7 rounded-full border border-[var(--glass-border)] flex items-center px-1 transition-all duration-500 cursor-pointer ${
                  isChecked ? 'bg-[var(--dynamic-aura,var(--aura-indigo))]/20 border-[var(--dynamic-aura,var(--aura-indigo))]/30' : 'bg-[var(--text-primary)]/[0.04]'
                }`}
              >
                <motion.div 
                  layout
                  animate={{ 
                    x: isChecked ? 20 : 0,
                    backgroundColor: isChecked ? 'var(--status-info)' : 'var(--text-secondary)'
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-4 h-4 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
                />
              </button>
            </div>
          );
        })}

        {/* Tema Seçimi Switch */}
        <div className="flex items-center justify-between gap-6 py-2 border-t border-[var(--glass-border)] pt-5 mt-5">
          <div className="space-y-1">
            <h5 className="text-xs font-semibold text-[var(--text-primary)]">Koyu Tema (Karanlık Mod)</h5>
            <p className="text-2xs text-[var(--text-secondary)]/75 leading-normal max-w-[280px] font-light">
              Uygulamanın görsel temasını el ile ayarlar. Açık olduğunda Koyu (Dark) modu etkinleştirir.
            </p>
          </div>
          <button
            onClick={(e) => toggleTheme(e)}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Koyu Tema"
            className={`w-12 h-7 rounded-full border border-[var(--glass-border)] flex items-center px-1 transition-all duration-500 cursor-pointer ${
              theme === 'dark' ? 'bg-[var(--dynamic-aura,var(--aura-indigo))]/20 border-[var(--dynamic-aura,var(--aura-indigo))]/30' : 'bg-[var(--text-primary)]/[0.04]'
            }`}
          >
            <motion.div 
              layout
              animate={{ 
                x: theme === 'dark' ? 20 : 0,
                backgroundColor: theme === 'dark' ? 'var(--status-info)' : 'var(--text-secondary)'
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-4 h-4 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
            />
          </button>
        </div>

        {/* Sesli Bildirim Okuma (TTS) Switch */}
        <div className="flex items-center justify-between gap-6 py-2">
          <div className="space-y-1">
            <h5 className="text-xs font-semibold text-[var(--text-primary)]">Sesli Bildirim Okuma</h5>
            <p className="text-2xs text-[var(--text-secondary)]/75 leading-normal max-w-[280px] font-light">
              Açıldığında, gelen bildirimler ekran okuyucu sesiyle yüksek sesle okunur. Varsayılan olarak kapalıdır.
            </p>
          </div>
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            role="switch"
            aria-checked={ttsEnabled}
            aria-label="Sesli Bildirim Okuma"
            className={`w-12 h-7 rounded-full border border-[var(--glass-border)] flex items-center px-1 transition-all duration-500 cursor-pointer ${
              ttsEnabled ? 'bg-[var(--dynamic-aura,var(--aura-indigo))]/20 border-[var(--dynamic-aura,var(--aura-indigo))]/30' : 'bg-[var(--text-primary)]/[0.04]'
            }`}
          >
            <motion.div
              layout
              animate={{
                x: ttsEnabled ? 20 : 0,
                backgroundColor: ttsEnabled ? 'var(--status-info)' : 'var(--text-secondary)'
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-4 h-4 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
            />
          </button>
        </div>

        {/* Bildirim Geçmişi */}
        <div className="flex items-center justify-between gap-6 py-2 border-t border-[var(--glass-border)] pt-5 mt-5">
          <div className="space-y-1">
            <h5 className="text-xs font-semibold text-[var(--text-primary)]">Bildirim Geçmişi</h5>
            <p className="text-2xs text-[var(--text-secondary)]/75 leading-normal max-w-[280px] font-light">
              Kaçırdığınız veya kapanmış bildirimleri (son {50}) buradan tekrar görüntüleyin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--text-primary)]/[0.03] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 text-2xs font-bold uppercase tracking-wide transition-all shrink-0"
          >
            <History size={14} />
            Görüntüle
          </button>
        </div>
      </div>

      <NotificationHistoryPanel isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </motion.div>
  );
}
