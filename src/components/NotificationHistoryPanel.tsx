import React from 'react';
import { Trash2, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Modal } from './ui/Modal';
import { useNotificationStore } from '../store/useNotificationStore';
import type { NotificationType } from './ui/NotificationToast';

interface NotificationHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_DOT_COLOR: Record<NotificationType, string> = {
  info: 'var(--status-info)',
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error: 'var(--status-danger)',
};

export function NotificationHistoryPanel({ isOpen, onClose }: NotificationHistoryPanelProps) {
  const history = useNotificationStore((s) => s.history);
  const clearHistory = useNotificationStore((s) => s.clearHistory);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="BİLDİRİM GEÇMİŞİ">
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BellOff size={28} className="text-[var(--text-secondary)]/30" />
          <p className="text-[11px] text-[var(--text-secondary)]/50 uppercase tracking-wide font-bold">Henüz bildirim yok</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={clearHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:border-[var(--status-danger)]/30 text-[11px] font-bold uppercase tracking-wide transition-all"
            >
              <Trash2 size={13} />
              Tümünü Temizle
            </button>
          </div>
          <ul className="space-y-3">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--text-primary)]/[0.02]"
              >
                <span
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: TYPE_DOT_COLOR[entry.type] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-xs font-medium text-[var(--text-primary)]">{entry.title}</h4>
                    <span className="text-[11px] text-[var(--text-secondary)]/40 shrink-0">
                      {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: tr })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]/60 leading-relaxed mt-1">{entry.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
