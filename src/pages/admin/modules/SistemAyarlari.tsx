import React, { useState } from 'react';
import { useSystemSettingsStore } from '../../../store/useSystemSettingsStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { Save, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { telemetryService } from '../../../services/telemetryService';
import { AdminLoadingState } from '../components/AdminLoadingState';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { playSuccess, playWarning } from '../../../lib/sounds';
import { senkronizeGuncelVeGelecekAyCache } from '../../../services/vakitCacheServisi';

type StatusMessage = {
 type: 'success' | 'warning' | 'error';
 text: string;
} | null;

export default function SistemAyarlari() {
 const { settings, loading, updateSettings } = useSystemSettingsStore();
 const { theme } = useThemeStore();
 const [ilceId, setIlceId] = useState('');
 const [ilceAdi, setIlceAdi] = useState('');
 const [hicriDuzeltme, setHicriDuzeltme] = useState(0);
 const [saving, setSaving] = useState(false);
 const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
 // İlçe kodu değişikliği, TÜM cemaatin ezan vakti kaynağını değiştiren
 // sistem geneli bir etkiye sahip — DuyuruYonetimi.tsx'in çok daha düşük
 // etkili silme işlemi için bile ConfirmModal kullanmasıyla karşılaştırılınca
 // buradaki tek-tıkla-kaydet tutarsızdı (bkz. mimari denetim, görsel/premium).
 const [pendingLocationChange, setPendingLocationChange] = useState<{
   ilceId: string; ilceAdi: string; hicriDuzeltme: number;
 } | null>(null);

 // Uzak ayar dokümanı değiştiğinde form alanlarını render sırasında
 // doldur — bkz. useBugunkuGorevlerim.ts'teki aynı desen.
 const [lastSettings, setLastSettings] = useState(settings);
 if (settings !== lastSettings) {
 setLastSettings(settings);
 if (settings) {
 setIlceId(settings.ilceId);
 setIlceAdi(settings.ilceAdi);
 setHicriDuzeltme(settings.hicriDuzeltme ?? 0);
 }
 }

 const performSave = async (cleanedIlceId: string, cleanedIlceAdi: string, normalizedHicriDuzeltme: number, locationChanged: boolean) => {
  setSaving(true);
  setStatusMessage(null);
  try {
  await updateSettings({
    ilceId: cleanedIlceId,
    ilceAdi: cleanedIlceAdi,
    hicriDuzeltme: normalizedHicriDuzeltme
  });

  if (locationChanged) {
    try {
      await senkronizeGuncelVeGelecekAyCache({ ilceId: cleanedIlceId, ilceAdi: cleanedIlceAdi });
      setStatusMessage({ type: 'success', text: 'Ayarlar kaydedildi ve vakit önbelleği güncellendi.' });
      playSuccess();
    } catch (cacheError) {
      console.error('Vakit önbelleği senkronizasyon hatası:', cacheError);
      setStatusMessage({ type: 'warning', text: 'Ayarlar kaydedildi; vakit önbelleği daha sonra Ezan Önbelleği ekranından yenilenmelidir.' });
      playWarning();
    }
  } else {
    setStatusMessage({ type: 'success', text: 'Dizge ayarları kaydedildi.' });
    playSuccess();
  }

  setTimeout(() => setStatusMessage(null), 5000);
  await telemetryService.logAudit('Dizge Ayarı Güncelleme', 'Vakit Bölgesi', `Diyanet İlçe Kodu: ${cleanedIlceId}, İlçe Adı: ${cleanedIlceAdi}, Hicri Düzeltme: ${normalizedHicriDuzeltme}`);
  } catch (error) {
  console.error("Ayar kaydetme hatası:", error);
  setStatusMessage({ type: 'error', text: 'Ayarlar kaydedilemedi. Yetki ve bağlantı durumunu kontrol edin.' });
  playWarning();
  } finally {
  setSaving(false);
 }
 };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();

  const cleanedIlceId = ilceId.trim();
  const cleanedIlceAdi = ilceAdi.trim();
  const normalizedHicriDuzeltme = Number(hicriDuzeltme);

  if (!/^\d+$/.test(cleanedIlceId)) {
    setStatusMessage({ type: 'error', text: 'Diyanet ilçe kodu yalnızca rakamlardan oluşmalıdır.' });
    playWarning();
    return;
  }

  if (cleanedIlceId.length < 3 || cleanedIlceId.length > 8) {
    setStatusMessage({ type: 'error', text: 'Diyanet ilçe kodu geçerli uzunlukta olmalıdır.' });
    playWarning();
    return;
  }

  if (cleanedIlceAdi.length < 2 || cleanedIlceAdi.length > 80) {
    setStatusMessage({ type: 'error', text: 'İlçe tanımı 2-80 karakter arasında olmalıdır.' });
    playWarning();
    return;
  }

  if (!Number.isInteger(normalizedHicriDuzeltme) || normalizedHicriDuzeltme < -2 || normalizedHicriDuzeltme > 2) {
    setStatusMessage({ type: 'error', text: 'Hicri tarih düzeltmesi -2 ile +2 gün arasında olmalıdır.' });
    playWarning();
    return;
  }

  const locationChanged = cleanedIlceId !== settings.ilceId || cleanedIlceAdi !== settings.ilceAdi;
  if (locationChanged) {
    // Sistem geneli etki (TÜM cemaatin ezan vakti kaynağı değişiyor) —
    // doğrudan kaydetmek yerine önce onay istenir.
    setPendingLocationChange({ ilceId: cleanedIlceId, ilceAdi: cleanedIlceAdi, hicriDuzeltme: normalizedHicriDuzeltme });
    return;
  }

  await performSave(cleanedIlceId, cleanedIlceAdi, normalizedHicriDuzeltme, false);
 };

 if (loading) return <AdminLoadingState label="Dizge ayarları okunuyor" />;

 return (
  <>
  <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="p-1 sm:p-8 relative overflow-hidden rounded-card border-none sm:border border-[var(--glass-border)] sm:bg-[var(--surface-low)] bg-transparent"
  >
  <div className="flex items-center gap-3 sm:gap-5 mb-6 sm:mb-8 relative z-10">
  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] bg-[var(--surface-medium)] flex items-center justify-center border border-[var(--glass-border)]">
  <MapPin className="text-[var(--dynamic-aura,var(--aura-indigo))] w-5 h-5" strokeWidth={1.6} />
  </div>
  <div>
  <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight">Vakit Bölgesi</h3>
  <p className="authority-title !text-2xs opacity-45 uppercase tracking-wide">Diyanet ilçe kodu ve hicri tarih ayarı</p>
  </div>
  </div>

  <form onSubmit={handleSave} className="space-y-6 sm:space-y-8 relative z-10">
     <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
       <div className="space-y-3">
         <label className="authority-title !text-2xs opacity-65 ml-1 tracking-wide">Diyanet İlçe Kodu</label>
         <div className="relative">
           <input 
             type="text" 
             value={ilceId}
             onChange={(e) => setIlceId(e.target.value)}
             inputMode="numeric"
             className="w-full bg-[var(--surface-medium)] border border-[var(--glass-border)] rounded-[14px] px-4 py-3.5 text-[var(--text-primary)] text-sm font-medium focus:border-[var(--dynamic-aura,var(--aura-indigo))]/50 outline-none transition-colors placeholder:text-[var(--text-secondary)]/35"
             placeholder="9148"
             required
           />
         </div>
       </div>
       
       <div className="space-y-3">
         <label className="authority-title !text-2xs opacity-65 ml-1 tracking-wide">İlçe Tanımı</label>
         <div className="relative">
           <input 
             type="text" 
             value={ilceAdi}
             onChange={(e) => setIlceAdi(e.target.value)}
             className="w-full bg-[var(--surface-medium)] border border-[var(--glass-border)] rounded-[14px] px-4 py-3.5 text-[var(--text-primary)] text-sm font-medium focus:border-[var(--dynamic-aura,var(--aura-indigo))]/50 outline-none transition-colors placeholder:text-[var(--text-secondary)]/35"
             placeholder="Ceyhan"
             required
           />
         </div>
       </div>

       <div className="space-y-3">
         <label className="authority-title !text-2xs opacity-65 ml-1 tracking-wide">Hicri Tarih Düzeltmesi</label>
         <div className="relative">
           <select 
             value={hicriDuzeltme}
             onChange={(e) => setHicriDuzeltme(Number(e.target.value))}
             className="w-full bg-[var(--surface-medium)] border border-[var(--glass-border)] rounded-[14px] px-4 py-3.5 text-[var(--text-primary)] text-sm font-medium focus:border-[var(--dynamic-aura,var(--aura-indigo))]/50 outline-none transition-colors"
             style={{ colorScheme: theme }}
           >
             <option value={-2} className="bg-[var(--card-elevated-bg)] text-[var(--text-primary)]">-2 Gün (Geriye Al)</option>
            <option value={-1} className="bg-[var(--card-elevated-bg)] text-[var(--text-primary)]">-1 Gün (Geriye Al)</option>
            <option value={0} className="bg-[var(--card-elevated-bg)] text-[var(--text-primary)]">Normal (Diyanet Uyumlu)</option>
             <option value={1} className="bg-[var(--card-elevated-bg)] text-[var(--text-primary)]">+1 Gün (İleriye Al)</option>
             <option value={2} className="bg-[var(--card-elevated-bg)] text-[var(--text-primary)]">+2 Gün (İleriye Al)</option>
           </select>
         </div>
       </div>
     </div>

  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-5 pt-6 border-t border-[var(--glass-border)]">
  <div className="flex items-center justify-center sm:justify-start gap-4">
  <AnimatePresence>
  {statusMessage && (
  <motion.div 
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  className={`flex items-center gap-3 px-4 py-2.5 rounded-[14px] border ${
    statusMessage.type === 'success'
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
      : statusMessage.type === 'warning'
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
  }`}
  >
  <div className="w-1.5 h-1.5 rounded-full bg-current" />
  <span className="text-2xs font-semibold tracking-wide">{statusMessage.text}</span>
  </motion.div>
  )}
  </AnimatePresence>
 </div>

 <motion.button 
 whileHover={{ y: -5, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
 whileTap={{ scale: 0.98 }}
  type="submit" 
  disabled={saving}
  className="bg-white text-black w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 rounded-[14px] font-bold text-2xs uppercase tracking-wide shadow-[var(--spatial-shadow)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
  >
  {saving ? (
  <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
  ) : <Save className="w-4 h-4" />}
  {saving ? 'İŞLENİYOR...' : 'AYARLARI KAYDET'}
  </motion.button>
  </div>
 </form>
 </motion.div>
 <ConfirmModal
   isOpen={pendingLocationChange !== null}
   onClose={() => setPendingLocationChange(null)}
   onConfirm={() => {
     if (!pendingLocationChange) return;
     const { ilceId: pId, ilceAdi: pAdi, hicriDuzeltme: pHicri } = pendingLocationChange;
     setPendingLocationChange(null);
     void performSave(pId, pAdi, pHicri, true);
   }}
   title="VAKİT BÖLGESİ DEĞİŞTİRİLECEK"
   message={`İlçe kodu "${settings.ilceId}" → "${pendingLocationChange?.ilceId}" olarak değiştirilecek. Bu, TÜM cemaatin ezan vakti kaynağını etkiler ve vakit önbelleği yeniden senkronize edilecektir.`}
   isDanger={false}
   confirmText="EVET, DEĞİŞTİR"
 />
 </>
 );
}
