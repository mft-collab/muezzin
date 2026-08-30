/**
 * Vite/Rollup, yeni bir deploy sonrası eski asset hash'lerine erişmeye çalışan
 * istemcilerde bu mesajlarla başarısız olur (tarayıcı önbelleğindeki eski
 * index.html hâlâ silinmiş chunk dosyalarını referans eder).
 */
export function isChunkLoadError(error: Error): boolean {
  return (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('dynamic import')
  );
}

/**
 * react-error-boundary v6, yakalanan hatayı `unknown` olarak tipler (JS'te
 * teorik olarak Error olmayan bir şey de throw edilebilir). React'in
 * render hatalarında pratikte her zaman bir Error örneği olsa da, tip
 * güvenliği için burada normalize ediyoruz.
 */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
