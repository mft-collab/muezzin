import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import IzinYonetimi from './IzinYonetimi';
import MazeretGecmisi from './MazeretGecmisi';
import { Calendar, FileText } from 'lucide-react';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

export default function IzinMazeretHub() {
 const [activeSubTab, setActiveSubTab] = useState<'izinler' | 'mazeretler'>('izinler');

 const tabs = [
 { id: 'izinler', label: 'AKTİF İZİN TALEPLERİ', icon: Calendar },
 { id: 'mazeretler', label: 'GEÇMİŞ MAZERET KAYITLARI', icon: FileText },
 ];

 return (
 <div className="flex flex-col gap-10">
 {/* INTERNAL SUB-NAV: Luminous Segmented Control */}
 <SegmentedTabs
 items={tabs}
 activeId={activeSubTab}
 onChange={(id) => setActiveSubTab(id as 'izinler' | 'mazeretler')}
 ariaLabel="İzin ve mazeret sekmeleri"
 idPrefix="izin"
 variant="segmented"
 />

 {/* CONTENT: Spatial Context Stream */}
 <div
 className="relative"
 role="tabpanel"
 id={`izin-panel-${activeSubTab}`}
 aria-labelledby={`izin-tab-${activeSubTab}`}
 tabIndex={0}
 >
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
