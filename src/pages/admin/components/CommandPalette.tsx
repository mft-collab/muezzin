import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Command, LayoutDashboard, CalendarDays, Users, Database, ShieldAlert, Bell, Settings, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
 id: string;
 title: string;
 description: string;
 icon: React.ReactNode;
 category: 'Navigasyon' | 'İşlemler' | 'Sistem';
 action: () => void;
}

export const CommandPalette: React.FC = () => {
 const [isOpen, setIsOpen] = useState(false);
 const [search, setSearch] = useState('');
 const [selectedIndex, setSelectedIndex] = useState(0);
 const navigate = useNavigate();
 const inputRef = useRef<HTMLInputElement>(null);

 const actions: CommandItem[] = [
 { 
 id: 'dash', title: 'Genel Bakış', description: 'Yönetim özetini ve canlı durumu gör', 
 icon: <LayoutDashboard size={18} />, category: 'Navigasyon', 
 action: () => navigate('/admin?tab=dashboard') 
 },
 { 
 id: 'plan', title: 'Hizmet Cetveli', description: 'Haftalık hizmet planlamasını yönet', 
 icon: <CalendarDays size={18} />, category: 'Navigasyon', 
 action: () => navigate('/admin?tab=planlama') 
 },
 { 
 id: 'ekip', title: 'Kadro Yönetimi', description: 'Müezzin ve kadro listesini düzenle', 
 icon: <Users size={18} />, category: 'Navigasyon', 
 action: () => navigate('/admin?tab=ekip') 
 },
 { 
 id: 'ayar', title: 'Sistem Ayarları', description: 'Uygulama parametrelerini yapılandır', 
 icon: <Settings size={18} />, category: 'Navigasyon', 
 action: () => navigate('/admin?tab=ayarlar') 
 },
 { 
 id: 'kriz', title: 'Nöbet Uyarıları', description: 'Çözülmemiş nöbet ve vakit uyarılarını listele', 
 icon: <ShieldAlert size={18} />, category: 'İşlemler', 
 action: () => navigate('/admin?tab=dashboard&sub=alarmlar') 
 },
 { 
 id: 'duyuru', title: 'Duyuru Yayınla', description: 'Yeni bir sistem duyurusu oluştur', 
 icon: <Bell size={18} />, category: 'İşlemler', 
 action: () => navigate('/admin?tab=dashboard&sub=duyurular') 
 },
 { 
 id: 'cache', title: 'Ezan Önbelleği', description: 'Vakit cache durumunu görüntüle ve senkronize et', 
 icon: <Database size={18} />, category: 'Sistem', 
 action: () => {
 sessionStorage.removeItem('admin_pendingIzinler');
 sessionStorage.removeItem('admin_activeDuyurular');
 sessionStorage.removeItem('admin_counts_time');
 navigate('/admin?tab=ayarlar&subtab=onbellek');
 } 
 },
 ];

 const filteredActions = actions.filter(action => 
 action.title.toLowerCase().includes(search.toLowerCase()) ||
 action.description.toLowerCase().includes(search.toLowerCase())
 );

 useEffect(() => {
 const handleKeyDown = (e: Event) => {
 if (e.type === 'admin-command-palette:open') {
 setIsOpen(true);
 return;
 }
 const ke = e as KeyboardEvent;
 if ((ke.metaKey || ke.ctrlKey) && ke.key === 'k') {
 ke.preventDefault();
 setIsOpen(prev => !prev);
 }
 if (ke.key === '/' && !isOpen) {
 ke.preventDefault();
 setIsOpen(true);
 }
 if (ke.key === 'Escape') setIsOpen(false);
 };

 window.addEventListener('keydown', handleKeyDown);
 window.addEventListener('admin-command-palette:open', handleKeyDown);
 return () => {
 window.removeEventListener('keydown', handleKeyDown);
 window.removeEventListener('admin-command-palette:open', handleKeyDown);
 };
 }, [isOpen]);

 useEffect(() => {
 if (isOpen) {
 setSearch('');
 setSelectedIndex(0);
 setTimeout(() => inputRef.current?.focus(), 100);
 }
 }, [isOpen]);

 const handleSelect = (action: CommandItem) => {
 action.action();
 setIsOpen(false);
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (filteredActions.length === 0) return;

 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setSelectedIndex(prev => (prev + 1) % filteredActions.length);
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
 } else if (e.key === 'Enter') {
 if (filteredActions[selectedIndex]) {
 handleSelect(filteredActions[selectedIndex]);
 }
 }
 };

 return (
 <AnimatePresence>
 {isOpen && (
 <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => setIsOpen(false)}
 className="absolute inset-0 bg-black/60 backdrop-blur-md"
 />

 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: -20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: -20 }}
 transition={{ type: 'spring', damping: 25, stiffness: 300 }}
 className="relative w-full max-w-2xl glass-liquid overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10"
 onKeyDown={handleKeyDown}
 >
 {/* Search Bar */}
 <div className="flex items-center px-6 py-5 border-b border-white/5">
 <Search className="text-[var(--dynamic-aura,var(--aura-indigo))] mr-4" size={20} />
 <input
 ref={inputRef}
 type="text"
 placeholder="Bir komut veya sayfa arayın..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="flex-1 bg-transparent border-none outline-none text-lg font-light text-white placeholder:text-white/20"
 />
 <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-mono text-white/40">
 <Command size={10} /> K
 </div>
 </div>

 {/* Results */}
 <div className="max-h-[60vh] overflow-y-auto p-2 no-scrollbar">
 {filteredActions.length > 0 ? (
 <div className="space-y-4 py-2">
 {['Navigasyon', 'İşlemler', 'Sistem'].map(cat => {
 const catActions = filteredActions.filter(a => a.category === cat);
 if (catActions.length === 0) return null;

 return (
 <div key={cat} className="px-4">
 <h3 className="text-[10px] font-bold uppercase tracking-wide text-white/20 mb-3 ml-2">{cat}</h3>
 <div className="space-y-1">
 {catActions.map((action) => {
 const globalIndex = filteredActions.indexOf(action);
 const isSelected = selectedIndex === globalIndex;

 return (
 <button
 key={action.id}
 onClick={() => handleSelect(action)}
 onMouseEnter={() => setSelectedIndex(globalIndex)}
 className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 group ${
 isSelected ? 'bg-[var(--dynamic-aura,var(--aura-indigo))]/20' : 'hover:bg-white/5'
 }`}
 >
 <div className="flex items-center gap-4">
 <div className={`p-2.5 rounded-xl transition-colors ${isSelected ? 'bg-[var(--dynamic-aura,var(--aura-indigo))] text-white' : 'bg-white/5 text-white/40'}`}>
 {action.icon}
 </div>
 <div className="text-left">
 <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-white/70'}`}>{action.title}</div>
 <div className="text-[11px] text-white/30 font-light">{action.description}</div>
 </div>
 </div>
 {isSelected && (
 <motion.div layoutId="arrow" className="text-[var(--dynamic-aura,var(--aura-indigo))] mr-2">
 <ChevronRight size={16} />
 </motion.div>
 )}
 </button>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="py-20 text-center">
 <div className="text-white/20 text-sm font-light">Sonuç bulunamadı...</div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20 font-medium uppercase tracking-wide">
 <div className="flex gap-4">
 <span className="flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/5">↑↓</kbd> Gezin</span>
 <span className="flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/5">Enter</kbd> Seç</span>
 </div>
 <div className="flex items-center gap-1.5">
 <kbd className="bg-white/10 px-1.5 py-0.5 rounded border border-white/5">Esc</kbd> Kapat
 </div>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );
};
