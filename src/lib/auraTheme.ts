import { Vakit } from '../types';

/**
 * Aktif vakte göre "sirkadiyen" arka plan aura rengi. AdminPanel.tsx,
 * useDashboardLogic.ts, HaftalikTakvim.tsx ve AnaEkranHero.tsx arasında
 * birebir kopyalanmış bir eşlemeydi (5 bağımsız kopya) — tek kaynağa
 * indirgendi (bkz. mimari denetim). NOT: `useCircadianTheme.ts`'in
 * `--dynamic-aura` için yazdığı DAHA ZENGİN, kerahat/cuma/teheccüd
 * dönemlerini de hesaba katan eşleme KASITLI OLARAK AYRI tutuldu — bu
 * fonksiyon yalnızca basit "hangi vakit" ambient arkaplanları için, o ise
 * canlı/global durum için; ikisini birleştirmek ayrı, görsel doğrulama
 * gerektiren bir karar.
 */
export function getActiveAuraColor(vakit: Vakit | 'gunes' | null | undefined): string {
  switch (vakit) {
    case 'aksam': return 'var(--aura-rose)';
    case 'yatsi': return 'var(--aura-indigo)';
    case 'ogle':
    case 'ikindi':
    case 'gunes': return 'var(--aura-amber)';
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
