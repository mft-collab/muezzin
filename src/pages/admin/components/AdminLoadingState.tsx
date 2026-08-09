interface AdminLoadingStateProps {
  /** Yükleme sırasında gösterilecek etiket (küçük harfle de yazılabilir — bileşen görsel olarak uppercase uygular). */
  label: string;
  /** Dış konteynerin yüksekliği — ekranın tipik içerik yüksekliğine göre ayarlanır. */
  heightClassName?: string;
  /** Spinner boyutu. */
  size?: 'md' | 'lg';
}

/**
 * Admin panelindeki tüm "veri yükleniyor" ekranlarının (İzin Yönetimi, Mazeret
 * Arşivi, Ezan Önbelleği, Dizge Ayarları, Duyuru Yönetimi, Sistem Analitiği)
 * ortak spinner+etiket bloğu — önceden 6 dosyada birebir kopyalanmıştı
 * (bkz. mimari denetim).
 */
export function AdminLoadingState({ label, heightClassName = 'h-[500px]', size = 'md' }: AdminLoadingStateProps) {
  const spinnerSizeClass = size === 'lg' ? 'w-14 h-14' : 'w-12 h-12';

  return (
    <div className={`flex ${heightClassName} items-center justify-center`}>
      <div className="flex flex-col items-center gap-6">
        <div className={`${spinnerSizeClass} border-4 border-[var(--dynamic-aura,var(--aura-indigo))]/10 border-t-[var(--dynamic-aura,var(--aura-indigo))] rounded-full animate-spin shadow-[var(--spatial-shadow)]`} />
        <p className="authority-title !text-2xs opacity-30 tracking-wide uppercase">{label}</p>
      </div>
    </div>
  );
}
