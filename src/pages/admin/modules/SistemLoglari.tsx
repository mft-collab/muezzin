import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Cpu, HeartPulse, ClipboardList } from 'lucide-react';

import { SistemHatalariSekmesi } from '../components/SistemHatalariSekmesi';
import { SistemTestleriSekmesi } from '../components/SistemTestleriSekmesi';
import { VeriSagligiSekmesi } from '../components/VeriSagligiSekmesi';
import { SistemDenetimSekmesi } from '../components/SistemDenetimSekmesi';
import { toJsDate } from '../../../lib/dateUtils';

export default function SistemLoglari() {
 const [activeTab, setActiveTab] = useState<'errors' | 'diagnostics' | 'health' | 'audit'>('errors');

 const formatDate = (timestamp: unknown) => {
 const date = toJsDate(timestamp);
 if (!date) return 'Şimdi';
 return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' +
 date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
 };

 return (
 <div className="space-y-8">
 {/* Header Info Banner */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div className="flex flex-col gap-1">
 <h3 className="text-lg font-light tracking-tight text-[var(--text-primary)]">Sistem Teşhis ve Hata Raporları</h3>
 <p className="premium-label !text-[10px] !opacity-35 tracking-wide">AKTİF KULLANIM DETAYLARI VE UYGULAMA SAĞLIĞI</p>
 </div>
 </div>

 {/* Tabs Layout */}
 <div role="tablist" aria-label="Sistem teşhis sekmeleri" className="flex border-b border-[var(--glass-border)] pb-0 gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
 <button
 role="tab"
 id="log-tab-errors"
 aria-selected={activeTab === 'errors'}
 aria-controls="log-panel-errors"
 tabIndex={activeTab === 'errors' ? 0 : -1}
 onClick={() => setActiveTab('errors')}
 className={`pb-4 text-xs font-medium tracking-wide transition-all relative whitespace-nowrap ${
 activeTab === 'errors' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)]/70'
 }`}
 >
 <span className="flex items-center gap-2">
 <ShieldAlert size={14} className={activeTab === 'errors' ? "text-rose-500" : ""} />
 Sistem Hataları
 </span>
 {activeTab === 'errors' && (
 <motion.div layoutId="logTabIndicator" className="absolute bottom-0 inset-x-0 h-0.5 bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_8px_var(--dynamic-aura,var(--aura-indigo))]" />
 )}
 </button>

 <button
 role="tab"
 id="log-tab-diagnostics"
 aria-selected={activeTab === 'diagnostics'}
 aria-controls="log-panel-diagnostics"
 tabIndex={activeTab === 'diagnostics' ? 0 : -1}
 onClick={() => setActiveTab('diagnostics')}
 className={`pb-4 text-xs font-medium tracking-wide transition-all relative whitespace-nowrap ${
 activeTab === 'diagnostics' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)]/70'
 }`}
 >
 <span className="flex items-center gap-2">
 <Cpu size={14} className={activeTab === 'diagnostics' ? "text-[var(--dynamic-aura,var(--aura-indigo))]" : ""} />
 Sistem Teşhisi (Self-Check)
 </span>
 {activeTab === 'diagnostics' && (
 <motion.div layoutId="logTabIndicator" className="absolute bottom-0 inset-x-0 h-0.5 bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_8px_var(--dynamic-aura,var(--aura-indigo))]" />
 )}
 </button>

 <button
 role="tab"
 id="log-tab-health"
 aria-selected={activeTab === 'health'}
 aria-controls="log-panel-health"
 tabIndex={activeTab === 'health' ? 0 : -1}
 onClick={() => setActiveTab('health')}
 className={`pb-4 text-xs font-medium tracking-wide transition-all relative whitespace-nowrap ${
 activeTab === 'health' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)]/70'
 }`}
 >
 <span className="flex items-center gap-2">
 <HeartPulse size={14} className={activeTab === 'health' ? "text-rose-400" : ""} />
 Veri Sağlığı ve Onarım
 </span>
 {activeTab === 'health' && (
 <motion.div layoutId="logTabIndicator" className="absolute bottom-0 inset-x-0 h-0.5 bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_8px_var(--dynamic-aura,var(--aura-indigo))]" />
 )}
 </button>

 <button
 role="tab"
 id="log-tab-audit"
 aria-selected={activeTab === 'audit'}
 aria-controls="log-panel-audit"
 tabIndex={activeTab === 'audit' ? 0 : -1}
 onClick={() => setActiveTab('audit')}
 className={`pb-4 text-xs font-medium tracking-wide transition-all relative whitespace-nowrap ${
 activeTab === 'audit' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)]/70'
 }`}
 >
 <span className="flex items-center gap-2">
 <ClipboardList size={14} className={activeTab === 'audit' ? "text-[var(--dynamic-aura,var(--aura-indigo))]" : ""} />
 Denetim İzleri (Audit Logs)
 </span>
 {activeTab === 'audit' && (
 <motion.div layoutId="logTabIndicator" className="absolute bottom-0 inset-x-0 h-0.5 bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_8px_var(--dynamic-aura,var(--aura-indigo))]" />
 )}
 </button>
 </div>

 {/* Main Listing Panel */}
 <div role="tabpanel" id={`log-panel-${activeTab}`} aria-labelledby={`log-tab-${activeTab}`} tabIndex={0}>
 {activeTab === 'errors' && <SistemHatalariSekmesi formatDate={formatDate} />}
 {activeTab === 'diagnostics' && <SistemTestleriSekmesi setActiveTab={setActiveTab} />}
 {activeTab === 'health' && <VeriSagligiSekmesi />}
 {activeTab === 'audit' && <SistemDenetimSekmesi formatDate={formatDate} />}
 </div>
 </div>
 );
}
