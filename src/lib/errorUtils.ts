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
