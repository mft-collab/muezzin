import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Cpu, HeartPulse } from 'lucide-react';

import { SistemHatalariSekmesi } from '../components/SistemHatalariSekmesi';
import { SistemTestleriSekmesi } from '../components/SistemTestleriSekmesi';
import { VeriSagligiSekmesi } from '../components/VeriSagligiSekmesi';

export default function SistemLoglari() {
  const [activeTab, setActiveTab] = useState<'errors' | 'diagnostics' | 'health'>('errors');

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Şimdi';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' - ' + 
           date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-8">
      {/* Header Info Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-light tracking-tight text-[var(--text-primary)]">Sistem Teşhis ve Hata Raporları</h3>
          <p className="premium-label !text-[8px] !opacity-35 tracking-[0.2em]">AKTİF KULLANIM DETAYLARI VE UYGULAMA SAĞLIĞI</p>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-[var(--glass-border)] pb-0 gap-8 overflow-x-auto">
        <button
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
            <motion.div layoutId="logTabIndicator" className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`pb-4 text-xs font-medium tracking-wide transition-all relative whitespace-nowrap ${
            activeTab === 'diagnostics' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)]/70'
          }`}
        >
          <span className="flex items-center gap-2">
            <Cpu size={14} className={activeTab === 'diagnostics' ? "text-indigo-400" : ""} />
            Sistem Teşhisi (Self-Check)
          </span>
          {activeTab === 'diagnostics' && (
            <motion.div layoutId="logTabIndicator" className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>

        <button
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
            <motion.div layoutId="logTabIndicator" className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Main Listing Panel */}
      {activeTab === 'errors' && <SistemHatalariSekmesi formatDate={formatDate} />}
      {activeTab === 'diagnostics' && <SistemTestleriSekmesi setActiveTab={setActiveTab} />}
      {activeTab === 'health' && <VeriSagligiSekmesi />}
    </div>
  );
}
