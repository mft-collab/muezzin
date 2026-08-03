import React from 'react';
import { motion } from 'motion/react';

export interface SegmentedTabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Underline variant only: custom active-icon color class (defaults to the dynamic aura color) */
  activeIconClassName?: string;
}

interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  /** Used to namespace aria ids (`${idPrefix}-tab-${id}` / `${idPrefix}-panel-${id}`) and motion layoutIds */
  idPrefix: string;
  variant?: 'pill' | 'segmented' | 'underline';
}

export function SegmentedTabs({ items, activeId, onChange, ariaLabel, idPrefix, variant = 'pill' }: SegmentedTabsProps) {
  const pillLayoutId = `${idPrefix}-pill`;
  const indicatorLayoutId = `${idPrefix}-indicator`;

  if (variant === 'segmented') {
    return (
      <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-1.5 bg-[var(--surface-low)] p-1 rounded-[20px] sm:rounded-[24px] border border-[var(--glass-border)] shadow-[var(--spatial-shadow)] w-full sm:w-auto">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 sm:gap-4 px-3 sm:px-8 py-3 sm:py-4 rounded-[16px] sm:rounded-[20px] transition-all duration-700 relative group overflow-hidden ${
                isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]/25 hover:text-[var(--text-primary)]/55'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId={pillLayoutId}
                  className="absolute inset-0 bg-[var(--surface-medium)] border border-[var(--glass-border)] shadow-[var(--spatial-shadow)] z-0"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-4">
                {Icon && (
                  <div className={`relative transition-all duration-700 ${isActive ? 'scale-110' : ''}`}>
                    <Icon size={18} strokeWidth={isActive ? 1.5 : 1} className={isActive ? 'text-[var(--dynamic-aura,var(--aura-indigo))]' : ''} />
                    {isActive && (
                      <motion.div
                        layoutId={`${idPrefix}-icon-aura`}
                        className="absolute inset-0 bg-[var(--dynamic-aura,var(--aura-indigo))]/20 blur-lg rounded-full"
                      />
                    )}
                  </div>
                )}
                <span className={`authority-title !text-2xs font-bold tracking-wide uppercase transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div role="tablist" aria-label={ariaLabel} className="flex border-b border-[var(--glass-border)] pb-0 gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={`pb-4 text-xs font-medium tracking-wide transition-all relative whitespace-nowrap ${
                isActive ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)]/70'
              }`}
            >
              <span className="flex items-center gap-2">
                {Icon && (
                  <Icon size={14} className={isActive ? (item.activeIconClassName || 'text-[var(--dynamic-aura,var(--aura-indigo))]') : ''} />
                )}
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId={indicatorLayoutId}
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-[var(--dynamic-aura,var(--aura-indigo))] shadow-[0_0_8px_var(--dynamic-aura,var(--aura-indigo))]"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // 'pill' variant (default) — sticky sub-page navigation style
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar">
      {items.map(item => {
        const isActive = activeId === item.id;
        return (
          <motion.button
            key={item.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={isActive}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={isActive ? 0 : -1}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(item.id)}
            className={`px-8 py-3.5 rounded-[20px] transition-all duration-500 whitespace-nowrap text-2xs font-bold uppercase tracking-wide relative group ${
              isActive
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-primary)]/20 hover:text-[var(--text-primary)]/50 hover:bg-[var(--text-primary)]/[0.02]'
            }`}
          >
            <span className="relative z-10">{item.label}</span>
            {isActive && (
              <motion.div
                layoutId={pillLayoutId}
                className="absolute inset-0 bg-[var(--surface-medium)] border border-[var(--glass-border)] rounded-[20px] -z-0 shadow-lg"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {isActive && (
              <motion.div
                layoutId={indicatorLayoutId}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[var(--dynamic-aura,var(--aura-indigo))] rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--dynamic-aura,var(--aura-indigo))_80%,transparent)]"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
