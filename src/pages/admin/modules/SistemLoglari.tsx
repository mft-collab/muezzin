import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Cpu, HeartPulse, ClipboardList } from 'lucide-react';

import { SistemHatalariSekmesi } from '../components/SistemHatalariSekmesi';
import { SistemTestleriSekmesi } from '../components/SistemTestleriSekmesi';
import { VeriSagligiSekmesi } from '../components/VeriSagligiSekmesi';
import { SistemDenetimSekmesi } from '../components/SistemDenetimSekmesi';
import { toJsDate } from '../../../lib/dateUtils';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

export type LogTab = 'errors' | 'diagnostics' | 'health' | 'audit';
const LOG_TAB_IDS: LogTab[] = ['errors', 'diagnostics', 'health', 'audit'];

const LOG_TABS = [
 { id: 'errors', label: 'Sistem Hataları', icon: ShieldAlert, activeIconClassName: 'text-rose-500' },
 { id: 'diagnostics', label: 'Sistem Teşhisi (Self-Check)', icon: Cpu },
 { id: 'health', label: 'Veri Sağlığı ve Onarım', icon: HeartPulse, activeIconClassName: 'text-rose-400' },
 { id: 'audit', label: 'Denetim İzleri (Audit Logs)', icon: ClipboardList },
];

export default function SistemLoglari() {
 // Diğer admin sekmeleriyle (?tab=, ?subtab=) aynı desen: bu iç sekme de
 // URL'e yazılır — derin bağlantı (deep-link) ve sayfa yenilemesinde konumu
 // koruma, yalnızca üst iki seviyeyle sınırlı kalmaz (bkz. tasarım denetimi).
 const [searchParams, setSearchParams] = useSearchParams();
 const logtabParam = searchParams.get('logtab');
 const activeTab: LogTab = LOG_TAB_IDS.includes(logtabParam as LogTab) ? (logtabParam as LogTab) : 'errors';

 const setActiveTab = (tab: LogTab) => {
 setSearchParams(prev => {
 const newParams = new URLSearchParams(prev);
 newParams.set('logtab', tab);
 return newParams;
 });
 };

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
 <p className="premium-label !text-2xs !opacity-35 tracking-wide">AKTİF KULLANIM DETAYLARI VE UYGULAMA SAĞLIĞI</p>
 </div>
 </div>

 {/* Tabs Layout */}
 <SegmentedTabs
 items={LOG_TABS}
 activeId={activeTab}
 onChange={(id) => setActiveTab(id as LogTab)}
 ariaLabel="Sistem teşhis sekmeleri"
 idPrefix="log"
 variant="underline"
 />

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
