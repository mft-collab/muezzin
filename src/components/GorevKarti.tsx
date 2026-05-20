/**
 * GorevKarti.tsx
 * Optimized task component with 5s polling interval and Spatial Design System.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bildirim } from '../types';
import { okudumOnayla } from '../services/okudumServisi';
import { mazeretBildir } from '../services/mazeretServisi';
import {
  getTurkeyNow,
  parseVakitToDate,
  VAKIT_GORA_ISIMLERI,
  toTurkishUpperCase,
} from '../lib/dateUtils';
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotificationStore } from '../store/useNotificationStore';

const AKTIF_KONTROL_INTERVAL_MS = 5_000;

const getStatusConfig = (bildirim: Bildirim) => {
  if (bildirim.durum === 'onaylandi')
    return { color: 'green' as const, text: 'Görev Onaylandı', icon: CheckCircle2 };
  if (bildirim.durum === 'reddedildi')
    return { color: 'red' as const, text: 'Mazeret Bildirildi', icon: AlertCircle };
  if (bildirim.tip === 'gorev_cagrisi')
    return { color: 'red' as const, text: 'Acil Çağrı', icon: AlertCircle };
  return {
    color: 'blue' as const,
    text: bildirim.tip === 'asil' ? 'Asil Görev' : 'Yedek Nöbet',
    icon: Info,
  };
};

export const GorevKarti = React.memo(({
  bildirim,
  saat,
}: { bildirim: Bildirim; saat: string }) => {
  const [isAktif, setIsAktif] = useState(() => {
    const ezanVakti = parseVakitToDate(bildirim.tarih, saat);
    return getTurkeyNow().getTime() >= ezanVakti.getTime();
  });
  const [isMazeretModalOpen, setIsMazeretModalOpen] = useState(false);
  const [mazeretSebebi, setMazeretSebebi] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onay, setOnay] = useState(false);
  const [uiMessage, setUiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const { showNotification } = useNotificationStore();

  useEffect(() => {
    if (!isMazeretModalOpen) {
      setMazeretSebebi('');
      setOnay(false);
    }
  }, [isMazeretModalOpen]);

  useEffect(() => {
    if (isAktif) return;
    const checkAktif = () => {
      const ezanVakti = parseVakitToDate(bildirim.tarih, saat);
      if (getTurkeyNow().getTime() >= ezanVakti.getTime()) {
        setIsAktif(true);
      }
    };
    const interval = setInterval(checkAktif, AKTIF_KONTROL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [bildirim.tarih, saat, isAktif]);

  const handleOkudum = useCallback(async () => {
    setUiMessage(null);
    try {
      await okudumOnayla(bildirim.id as string);
      const text = 'Başarıyla onaylandı.';
      setUiMessage({ type: 'success', text });
      showNotification('İşlem Başarılı', text, 'success');
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.';
      setUiMessage({ type: 'error', text });
      showNotification('Hata Oluştu', text, 'error');
    }
  }, [bildirim.id, showNotification]);

  const submitMazeret = useCallback(async () => {
    if (!mazeretSebebi.trim()) {
      const text = 'Lütfen mazeretinizi kısaca belirtin.';
      setUiMessage({ type: 'error', text });
      showNotification('Uyarı', text, 'warning');
      return;
    }
    setUiMessage(null);
    setIsSubmitting(true);
    try {
      await mazeretBildir(bildirim.id as string, mazeretSebebi);
      setIsMazeretModalOpen(false);
      const text = 'Mazeretiniz kaydedildi ve görev devredildi.';
      setUiMessage({ type: 'success', text });
      showNotification('Mazeret Kaydedildi', text, 'info');
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : 'Mazeret kaydedilirken hata oluştu.';
      setUiMessage({ type: 'error', text });
      showNotification('Hata Oluştu', text, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [bildirim.id, mazeretSebebi, showNotification]);

  const config = getStatusConfig(bildirim);

  return (
    <>
      <motion.div
        whileHover={{ y: -4, scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.6 }}
        className={`p-4 sm:p-8 spatial-glass relative overflow-hidden group ${
          bildirim.durum === 'onaylandi' ? 'border-emerald-500/20 shadow-lg shadow-emerald-500/5' : ''
        } ${isAktif && bildirim.durum === 'bekliyor' ? 'animate-living-glow' : ''}`}
      >
        {/* Status Indicator Pillar (Luminous) */}
        <div 
          className={`absolute left-0 top-0 bottom-0 w-[4px] transition-all duration-700 ${isAktif && bildirim.durum === 'bekliyor' ? 'animate-pulse' : ''}`}
          style={{
            background: bildirim.durum === 'onaylandi'
              ? 'var(--status-success)'
              : bildirim.durum === 'reddedildi'
              ? 'var(--status-danger)'
              : bildirim.tip === 'gorev_cagrisi'
              ? 'var(--status-danger)'
              : 'var(--status-info)',
            boxShadow: `0 0 20px ${
              bildirim.durum === 'onaylandi' ? 'var(--status-success)' : 
              (bildirim.durum === 'reddedildi' || bildirim.tip === 'gorev_cagrisi' ? 'var(--status-danger)' : 'var(--status-info)')
            }44`
          }}
        />

        {/* Kinetic Refraction Sheen */}
        <div className="kinetic-sheen" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-8 sm:mb-10 relative z-10">
          <div className="flex items-center gap-4 sm:gap-7">
            <div
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-[22px] flex items-center justify-center transition-all duration-700 group-hover:rotate-3 border shadow-lg ${
                config.color === 'red'
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  : config.color === 'green'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
              }`}
            >
              <config.icon size={24} strokeWidth={1.5} className="sm:size-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2.5">
                <motion.div
                  animate={isAktif ? { 
                    scale: [1, 1.4, 1, 1.2, 1],
                    opacity: [0.4, 1, 0.4, 0.7, 0.4]
                  } : {}}
                  transition={{ duration: 3, repeat: Infinity, times: [0, 0.1, 0.2, 0.3, 0.5] }}
                  className={`w-2 h-2 rounded-full ${
                    isAktif ? 'bg-emerald-500 shadow-[0_0_10px_var(--status-success)]' : 'bg-[var(--text-primary)]/10'
                  }`}
                />
                <p className="authority-title !text-[7px] tracking-[0.4em] opacity-40 uppercase">
                  {toTurkishUpperCase(bildirim.vakit)} VAKTİ • BUGÜN
                </p>
              </div>
              <h3 className="text-2xl sm:text-4xl font-light text-[var(--text-primary)] tracking-tight leading-none mb-4">
                {toTurkishUpperCase(VAKIT_GORA_ISIMLERI[bildirim.vakit])}
              </h3>
              <div className="flex items-center gap-2">
                <div className="px-4 py-1.5 bg-[var(--text-primary)]/[0.03] rounded-2xl flex items-center gap-2.5 border border-[var(--glass-border)] shadow-sm">
                  <Clock size={12} strokeWidth={2} className="text-indigo-400" />
                  <span className="text-[13px] font-medium tabular-nums text-[var(--text-primary)] opacity-80">
                    {saat}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`px-4 py-1.5 rounded-xl text-[7px] font-bold uppercase tracking-[0.25em] border transition-all duration-500 shadow-sm ${
              config.color === 'red'
                ? 'border-rose-500/20 text-rose-500 bg-rose-500/5'
                : config.color === 'green'
                ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5'
                : 'border-indigo-500/20 text-indigo-500 bg-indigo-500/5'
            }`}
          >
            {config.text}
          </div>
        </div>

        <AnimatePresence>
          {uiMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div
                className={`p-6 rounded-[28px] text-[13px] font-light border leading-relaxed flex items-center gap-5 ${
                  uiMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner ${
                    uiMessage.type === 'success' ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                  }`}
                >
                  {uiMessage.type === 'success' ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                </div>
                {uiMessage.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {bildirim.durum === 'bekliyor' && (
          <div className="flex flex-col sm:flex-row gap-5 items-center">
            <motion.button
              whileHover={isAktif ? { y: -2, scale: 1.02 } : {}}
              whileTap={isAktif ? { scale: 0.98 } : {}}
              onClick={isAktif ? handleOkudum : undefined}
              disabled={!isAktif}
              className={`flex-1 w-full py-5 rounded-[22px] font-bold text-[8px] tracking-[0.4em] uppercase transition-all duration-700 relative overflow-hidden group/btn shadow-lg ${
                isAktif
                  ? 'bg-indigo-500 text-white shadow-indigo-500/20'
                  : 'bg-[var(--text-primary)]/[0.03] text-[var(--text-primary)]/10 cursor-not-allowed border border-[var(--glass-border)]'
              }`}
            >
              {isAktif ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    {bildirim.tip === 'asil' ? 'GÖREV İCRASINI ONAYLA' : 'NÖBETİ DEVRE AL'}
                    <ChevronRight
                      size={16}
                      strokeWidth={2}
                      className="transition-transform group-hover/btn:translate-x-1"
                    />
                  </span>
                </>
              ) : (
                <span className="flex items-center justify-center gap-2.5 opacity-40">
                  <Clock size={14} strokeWidth={2} /> HİZMET SÜRESİ BEKLENİYOR
                </span>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(244, 63, 94, 0.08)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsMazeretModalOpen(true)}
              className="flex-1 w-full py-5 rounded-[22px] font-bold text-[8px] tracking-[0.4em] uppercase transition-all duration-700 text-rose-500 bg-rose-500/[0.03] border border-rose-500/20 shadow-sm"
            >
              MAZERET KAYDI OLUŞTUR
            </motion.button>
          </div>
        )}

        {bildirim.durum === 'onaylandi' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full py-6 rounded-[28px] bg-emerald-500/[0.03] text-emerald-500 font-light text-center text-[11px] tracking-[0.2em] border border-emerald-500/10 flex flex-col sm:flex-row items-center justify-between px-8 gap-5"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={18} strokeWidth={2} />
              </div>
              <span className="authority-title !text-[9px] !text-inherit">SİSTEM TARAFINDAN TEYİT EDİLDİ</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(244, 63, 94, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMazeretModalOpen(true)}
              className="px-6 py-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/10 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] transition-all"
            >
              MAZERET BİLDİR
            </motion.button>
          </motion.div>
        )}

        {bildirim.durum === 'reddedildi' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full py-6 rounded-[28px] bg-rose-500/[0.03] text-rose-500 font-light text-center text-[11px] tracking-[0.2em] border border-rose-500/10 flex items-center justify-center gap-4"
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
              <AlertCircle size={18} strokeWidth={2} />
            </div>
            <span className="authority-title !text-[9px] !text-inherit">MAZERET NEDENİYLE GÖREV DEVRİ</span>
          </motion.div>
        )}
      </motion.div>

      {/* Mazeret Modal (Portaled) */}
      {createPortal(
        <AnimatePresence>
          {isMazeretModalOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setIsMazeretModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 32 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="spatial-glass w-full max-w-sm p-10 !rounded-[34px] shadow-2xl relative z-10"
              >
                <div className="flex flex-col items-center text-center mb-12">
                  <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-[30px] flex items-center justify-center mb-8 border border-rose-500/20 shadow-inner">
                    <AlertCircle size={36} strokeWidth={1} />
                  </div>
                  <h2 className="text-3xl font-light text-[var(--text-primary)] tracking-tight leading-none">
                    Mazeret Kaydı
                  </h2>
                  <p className="authority-title !text-[7px] mt-5 opacity-30 px-6 leading-relaxed uppercase">
                    BEYANINIZ SİSTEME İŞLENECEK VE GÖREV DEVRİ GERÇEKLEŞECEKTİR.
                  </p>
                </div>

                <textarea
                  className="w-full bg-[var(--text-primary)]/[0.03] border border-[var(--glass-border)] rounded-2xl p-5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50 transition-all font-light text-sm shadow-inner placeholder:opacity-20 placeholder:font-extralight"
                  rows={3}
                  placeholder="Nedenini kısaca belirtin..."
                  value={mazeretSebebi}
                  onChange={(e) => setMazeretSebebi(e.target.value)}
                  autoFocus
                />

                <div className="mt-6 flex items-start gap-4 px-2">
                  <input
                    type="checkbox"
                    id="onay"
                    checked={onay}
                    onChange={(e) => setOnay(e.target.checked)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="onay"
                    className="text-[11px] text-[var(--text-secondary)]/60 leading-relaxed cursor-pointer select-none"
                  >
                    Mazeretimin geri alınamayacağını ve görev devrinin gerçekleşeceğini anladım.
                  </label>
                </div>

                <div className="flex flex-col gap-5 mt-10">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={submitMazeret}
                    disabled={isSubmitting || !mazeretSebebi.trim() || !onay}
                    className="w-full py-4 bg-rose-500 text-white font-bold rounded-[20px] hover:opacity-90 transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-xl shadow-rose-500/20 text-[10px] tracking-[0.3em] uppercase"
                  >
                    {isSubmitting ? 'İŞLENİYOR...' : 'KAYDI TAMAMLA'}
                  </motion.button>
                  <button
                    onClick={() => setIsMazeretModalOpen(false)}
                    className="w-full py-2 text-[var(--text-secondary)]/30 font-bold text-[9px] tracking-[0.3em] uppercase hover:text-[var(--text-primary)] transition-all duration-500"
                  >
                    VAZGEÇ
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
});
