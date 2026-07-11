import { Vakit } from '../types';

/**
 * Aktif vakte göre "sirkadiyen" arka plan aura rengi. AdminPanel.tsx ve
 * useDashboardLogic.ts arasında birebir kopyalanmış bir eşlemeydi — tek
 * kaynağa indirgendi.
 */
export function getActiveAuraColor(vakit: Vakit | null | undefined): string {
  switch (vakit) {
    case 'aksam': return 'var(--aura-rose)';
    case 'yatsi': return 'var(--aura-indigo)';
    case 'ogle':
    case 'ikindi': return 'var(--aura-amber)';
    case 'sabah': return 'var(--aura-emerald)';
    default: return 'var(--aura-indigo)';
  }
}

/** Ana aura ile kontrast oluşturan sekonder tamamlayıcı renk. */
export function getSecondaryAuraColor(vakit: Vakit | null | undefined): string {
  switch (vakit) {
    case 'aksam': return 'var(--aura-indigo)';
    case 'yatsi': return 'var(--aura-emerald)';
    case 'ogle':
    case 'ikindi': return 'var(--aura-rose)';
    case 'sabah': return 'var(--aura-amber)';
    default: return 'var(--aura-emerald)';
  }
}
