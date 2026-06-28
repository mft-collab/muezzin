import React, { useState, useEffect } from 'react';
import { useSystemSettingsStore } from '../../../store/useSystemSettingsStore';
import { Save, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { telemetryService } from '../../../services/telemetryService';
import { playSuccess, playWarning } from '../../../lib/sounds';

export default function SistemAyarlari() {
 const { settings, loading, updateSettings } = useSystemSettingsStore();
 const [ilceId, setIlceId] = useState('');
 const [ilceAdi, setIlceAdi] = useState('');
 const [hicriDuzeltme, setHicriDuzeltme] = useState(0);
 const [saving, setSaving] = useState(false);
 const [success, setSuccess] = useState(false);

 useEffect(() => {
 if (settings) {
 setIlceId(settings.ilceId);
 setIlceAdi(settings.ilceAdi);
 setHicriDuzeltme(settings.hicriDuzeltme ?? 0);
 }
 }, [settings]);

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 
 const cleanedIlceId = ilceId.trim();
 const cleanedIlceAdi = ilceAdi.trim();
 
 if (!/^\d+$/.test(cleanedIlceId)) {
   playWarning();
   return;
 }
 
 setSaving(true);
 setSuccess(false);
 try {
 await updateSettings({ 
   ilceId: cleanedIlceId, 
   ilceAdi: cleanedIlceAdi, 
   hicriDuzeltme: Number(hicriDuzeltme) 
 });
 playSuccess();
 setSuccess(true);
 setTimeout(() => setSuccess(false), 3000);
 await telemetryService.logAudit('Sistem Ayarı Güncelleme', 'Sistem Lokasyonu', `Diyanet İlçe Kodu: ${cleanedIlceId}, İlçe Adı: ${cleanedIlceAdi}, Hicri Düzeltme: ${hicriDuzeltme}`);
 } catch (error) {
 console.error("Ayar kaydetme hatası:", error);
 playWarning();
 } finally {
 setSaving(false);
 }
 };

 if (loading) return null;

 return (
 <motion.div 
 initial={{ opacity: 0, y: 20 }} 
 animate={{ opacity: 1, y: 0 }} 
 className="p-1 sm:p-10 relative overflow-hidden rounded-[20px] sm:rounded-[40px] border-none sm:border border-[var(--glass-border)] sm:spatial-glass sm:shadow-[var(--spatial-shadow)] group bg-transparent"
 >
 {/* Living Aura */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--dynamic-aura,var(--aura-indigo))]/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
 
 <div className="flex items-center gap-3 sm:gap-6 mb-6 sm:mb-12 relative z-10">
 <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-[16px] sm:rounded-[22px] bg-white/[0.03] flex items-center justify-center border border-white/10 shadow-[var(--spatial-shadow)] transition-transform duration-700">
 <MapPin className="text-[var(--dynamic-aura,var(--aura-indigo))] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.2} />
 </div>
 <div>
 <h3 className="text-lg sm:text-2xl font-light text-white tracking-tight leading-none mb-2">Sistem Lokasyonu</h3>
 <p className="authority-title !text-[7px] opacity-30 uppercase tracking-wide">OPERASYONEL API VE COĞRAFİ PARAMETRELER</p>
 </div>
 </div>

 <form onSubmit={handleSave} className="space-y-6 sm:space-y-10 relative z-10">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="space-y-4 group">
        <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-wide group-hover:opacity-100 group-hover:font-black transition-all duration-700">DİYANET İLÇE KODU (ID)</label>
        <div className="relative group/input">
          <input 
            type="text" 
            value={ilceId}
            onChange={(e) => setIlceId(e.target.value)}
            className="w-full spatial-glass-elevated border border-white/5 rounded-[16px] sm:rounded-3xl px-4 py-3.5 sm:px-8 sm:py-6 text-white text-sm sm:text-lg font-light focus:bg-white/[0.05] focus:border-[var(--dynamic-aura,var(--aura-indigo))]/40 outline-none transition-all duration-700 shadow-inner placeholder:text-white/5"
            placeholder="Örn: 9148"
            required
          />
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--dynamic-aura,var(--aura-indigo))]/0 to-transparent group-focus-within/input:via-[var(--dynamic-aura,var(--aura-indigo))]/40 transition-all duration-1000" />
        </div>
      </div>
      
      <div className="space-y-4 group">
        <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-wide group-hover:opacity-100 group-hover:font-black transition-all duration-700">YEDEK İLÇE TANIMI</label>
        <div className="relative group/input">
          <input 
            type="text" 
            value={ilceAdi}
            onChange={(e) => setIlceAdi(e.target.value)}
            className="w-full spatial-glass-elevated border border-white/5 rounded-[16px] sm:rounded-3xl px-4 py-3.5 sm:px-8 sm:py-6 text-white text-sm sm:text-lg font-light focus:bg-white/[0.05] focus:border-[var(--dynamic-aura,var(--aura-indigo))]/40 outline-none transition-all duration-700 shadow-inner placeholder:text-white/5"
            placeholder="Örn: Ceyhan"
            required
          />
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--dynamic-aura,var(--aura-indigo))]/0 to-transparent group-focus-within/input:via-[var(--dynamic-aura,var(--aura-indigo))]/40 transition-all duration-1000" />
        </div>
      </div>

      <div className="space-y-4 group">
        <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-wide group-hover:opacity-100 group-hover:font-black transition-all duration-700">HİCRİ TARİH DÜZELTMESİ (GÜN KAYDIRMA)</label>
        <div className="relative group/input">
          <select 
            value={hicriDuzeltme}
            onChange={(e) => setHicriDuzeltme(Number(e.target.value))}
            className="w-full spatial-glass-elevated border border-white/5 rounded-[16px] sm:rounded-3xl px-4 py-3.5 sm:px-8 sm:py-6 text-white text-sm sm:text-lg font-light focus:bg-white/[0.05] focus:border-[var(--dynamic-aura,var(--aura-indigo))]/40 outline-none transition-all duration-700 shadow-inner"
            style={{ colorScheme: 'dark' }}
          >
            <option value={-2} className="bg-neutral-900 text-white">-2 Gün (Geriye Al)</option>
            <option value={-1} className="bg-neutral-900 text-white">-1 Gün (Geriye Al)</option>
            <option value={0} className="bg-neutral-900 text-white">Normal (Diyanet Uyumlu)</option>
            <option value={1} className="bg-neutral-900 text-white">+1 Gün (İleriye Al)</option>
            <option value={2} className="bg-neutral-900 text-white">+2 Gün (İleriye Al)</option>
          </select>
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--dynamic-aura,var(--aura-indigo))]/0 to-transparent group-focus-within/input:via-[var(--dynamic-aura,var(--aura-indigo))]/40 transition-all duration-1000" />
        </div>
      </div>
    </div>

 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6 pt-10 border-t border-white/5">
 <div className="flex items-center justify-center sm:justify-start gap-4">
 <AnimatePresence>
 {success && (
 <motion.div 
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -20 }}
 className="flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20"
 >
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
 <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-400">PARAMETRELER GÜNCELLENDİ</span>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 <motion.button 
 whileHover={{ y: -5, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
 whileTap={{ scale: 0.98 }}
 type="submit" 
 disabled={saving}
 className="bg-white text-black w-full sm:w-auto px-6 py-3.5 sm:px-12 sm:py-5 rounded-[14px] sm:rounded-[22px] font-bold text-[9px] sm:text-[10px] uppercase tracking-wide shadow-[var(--spatial-shadow)] transition-all disabled:opacity-50 flex items-center justify-center gap-4 cursor-pointer"
 >
 {saving ? (
 <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
 ) : <Save className="w-4 h-4" />}
 {saving ? 'İŞLENİYOR...' : 'AYARLARI UYGULA'}
 </motion.button>
 </div>
 </form>
 </motion.div>
 );
}
