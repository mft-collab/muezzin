import React, { useState, useEffect } from 'react';
import { useSystemSettingsStore } from '../../../store/useSystemSettingsStore';
import { Save, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SistemAyarlari() {
  const { settings, loading, updateSettings } = useSystemSettingsStore();
  const [ilceId, setIlceId] = useState('');
  const [ilceAdi, setIlceAdi] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setIlceId(settings.ilceId);
      setIlceAdi(settings.ilceAdi);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await updateSettings({ ilceId, ilceAdi });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Ayar kaydetme hatası:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="spatial-glass p-10 relative overflow-hidden !rounded-[40px] border border-[var(--glass-border)] shadow-2xl group"
    >
      {/* Living Aura */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="flex items-center gap-6 mb-12 relative z-10">
        <div className="w-14 h-14 rounded-[22px] bg-white/[0.03] flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-700">
          <MapPin className="text-indigo-400" size={24} strokeWidth={1.2} />
        </div>
        <div>
          <h3 className="text-2xl font-light text-white tracking-tight leading-none mb-2">Sistem Lokasyonu</h3>
          <p className="authority-title !text-[7px] opacity-30 uppercase tracking-[0.3em]">OPERASYONEL API VE COĞRAFİ PARAMETRELER</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 group">
            <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em] group-hover:opacity-100 group-hover:font-black transition-all duration-700">DİYANET İLÇE KODU (ID)</label>
            <div className="relative group/input">
               <input 
                type="text" 
                value={ilceId}
                onChange={(e) => setIlceId(e.target.value)}
                className="w-full spatial-glass-elevated border border-white/5 rounded-3xl px-8 py-6 text-white text-lg font-light focus:bg-white/[0.05] focus:border-indigo-500/30 outline-none transition-all duration-700 shadow-inner placeholder:text-white/5"
                placeholder="Örn: 9148"
                required
               />
               <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-indigo-500/0 to-transparent group-focus-within/input:via-indigo-500/40 transition-all duration-1000" />
            </div>
          </div>
          
          <div className="space-y-4 group">
            <label className="authority-title !text-[7px] opacity-40 ml-1 tracking-[0.3em] group-hover:opacity-100 group-hover:font-black transition-all duration-700">YEDEK İLÇE TANIMI</label>
            <div className="relative group/input">
               <input 
                type="text" 
                value={ilceAdi}
                onChange={(e) => setIlceAdi(e.target.value)}
                className="w-full spatial-glass-elevated border border-white/5 rounded-3xl px-8 py-6 text-white text-lg font-light focus:bg-white/[0.05] focus:border-indigo-500/30 outline-none transition-all duration-700 shadow-inner placeholder:text-white/5"
                placeholder="Örn: Ceyhan"
                required
               />
               <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-indigo-500/0 to-transparent group-focus-within/input:via-indigo-500/40 transition-all duration-1000" />
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
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-emerald-400">PARAMETRELER GÜNCELLENDİ</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button 
            whileHover={{ y: -5, scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
            whileTap={{ scale: 0.98 }}
            type="submit" 
            disabled={saving}
            className="bg-white text-black px-12 py-5 rounded-[22px] font-bold text-[10px] uppercase tracking-[0.3em] shadow-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-4"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
            ) : <Save size={16} />}
            {saving ? 'İŞLENİYOR...' : 'AYARLARI UYGULA'}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}
