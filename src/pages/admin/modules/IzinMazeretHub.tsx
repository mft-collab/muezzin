import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import IzinYonetimi from './IzinYonetimi';
import MazeretGecmisi from './MazeretGecmisi';
import { Calendar, FileText } from 'lucide-react';

export default function IzinMazeretHub() {
 const [activeSubTab, setActiveSubTab] = useState<'izinler' | 'mazeretler'>('izinler');

 const tabs = [
 { id: 'izinler', label: 'AKTİF İZİN TALEPLERİ', icon: Calendar },
 { id: 'mazeretler', label: 'GEÇMİŞ MAZERET KAYITLARI', icon: FileText },
 ];

 return (
 <div className="flex flex-col gap-10">
 {/* INTERNAL SUB-NAV: Luminous Segmented Control */}
 <div className="flex items-center gap-1.5 bg-[var(--surface-low)] p-1 rounded-[20px] sm:rounded-[24px] border border-[var(--glass-border)] shadow-[var(--spatial-shadow)] w-full sm:w-auto">
 {tabs.map(tab => {
 const Icon = tab.icon;
 const isActive = activeSubTab === tab.id;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveSubTab(tab.id as any)}
 className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 sm:gap-4 px-3 sm:px-8 py-3 sm:py-4 rounded-[16px] sm:rounded-[20px] transition-all duration-700 relative group overflow-hidden ${
 isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]/25 hover:text-[var(--text-primary)]/55'
 }`}
 >
 {/* Morphing Background Pill */}
 {isActive && (
 <motion.div 
 layoutId="activeSubTabPill"
 className="absolute inset-0 bg-[var(--surface-medium)] border border-[var(--glass-border)] shadow-[var(--spatial-shadow)] z-0"
 transition={{ type: "spring", stiffness: 400, damping: 30 }}
 />
 )}

 {/* Luminous Glow for Active Icon */}
 <div className="relative z-10 flex items-center gap-4">
 <div className={`relative transition-all duration-700 ${isActive ? 'scale-110' : ''}`}>
 <Icon size={18} strokeWidth={isActive ? 1.5 : 1} className={isActive ? 'text-[var(--dynamic-aura,var(--aura-indigo))]' : ''} />
 {isActive && (
 <motion.div 
 layoutId="iconAura"
 className="absolute inset-0 bg-[var(--dynamic-aura,var(--aura-indigo))]/20 blur-lg rounded-full" 
 />
 )}
 </div>
 <span className={`authority-title !text-[9px] font-bold tracking-wide uppercase transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
 {tab.label}
 </span>
 </div>
 </button>
 );
 })}
 </div>

 {/* CONTENT: Spatial Context Stream */}
 <div className="relative">
 <AnimatePresence mode="wait">
 <motion.div
 key={activeSubTab}
 initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
 animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
 exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
 transition={{ type: "spring", stiffness: 400, damping: 35 }}
 >
 {activeSubTab === 'izinler' ? <IzinYonetimi /> : <MazeretGecmisi />}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>
 );
}
