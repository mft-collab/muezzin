interface SkeletonProps {
  className?: string;
  rounded?: string;
}

/**
 * Tek shimmer ilkeli — `index.css`'teki `skeleton-shimmer` (arka plan
 * gradyanı + tarama animasyonu) üzerine köşe/kenarlık ekler. Önceden aynı
 * amaç için `fluid-skeleton` (kendi sabit 16px radius'unu dayatıyordu ve
 * `rounded-card` gibi çağıran-taraflı radius'larla çakışıyordu) ve
 * `skeleton-shimmer` iki ayrı utility olarak yaşıyordu (bkz. premium
 * denetim B28, O1) — `fluid-skeleton` kaldırıldı, bu tek bileşene çıkarıldı.
 */
export function Skeleton({ className = '', rounded = 'rounded-2xl' }: SkeletonProps) {
  return <div className={`skeleton-shimmer border border-[var(--glass-border)] ${rounded} ${className}`} />;
}

interface PageSkeletonProps {
  height?: string;
  className?: string;
}

/**
 * Lazy-yüklenen bir modülün Suspense fallback'i — başlık çubuğu + gövde
 * bloğu. Önceden AdminPanel (iki yerde) / PersonelHub / AyarlarHub içinde
 * birebir kopyalanmıştı (bkz. premium denetim B28, O1); tek kaynağa çıkarıldı.
 */
export function PageSkeleton({ height = 'h-[60vh]', className = '' }: PageSkeletonProps) {
  return (
    <div className={`${height} flex flex-col gap-6 w-full opacity-50 ${className}`}>
      <Skeleton className="w-48 h-8" rounded="rounded-full" />
      <Skeleton className="flex-1 w-full" rounded="rounded-card" />
    </div>
  );
}
