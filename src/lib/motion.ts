/**
 * Paylaşılan motion/react fizik token'ları (bkz. premium denetim B22, Y4).
 * Kod tabanında aynı jest (kart hover, modal açılış, liste stagger) için 14
 * farklı spring konfigürasyonu ve 3 farklı easing dizisi bağımsız olarak
 * yazılmıştı — aynı elemanın farklı ekranlarda farklı bir fizikle çalışmasına
 * yol açıyordu. Buradaki üç grup, en sık tekrarlanan (ölçülen) değerleri
 * temsil eder; YENİ kod bunları kullanır, mevcut çağrı noktaları geriye
 * dönük uyumluluk için değiştirilmeden bırakıldı (bkz. CLAUDE.md).
 */

export const SPRING = {
  /** Sekme/pill göstergesi, layoutId morph'ları — en sık kullanılan (13 kullanım). */
  snappy: { type: 'spring', stiffness: 400, damping: 30 } as const,
  /** Kart hover/tilt gibi daha yumuşak, ağırlıklı hareketler. */
  gentle: { type: 'spring', stiffness: 260, damping: 28 } as const,
  /** Modal/drawer/bottom-sheet açılışı. */
  sheet: { type: 'spring', stiffness: 320, damping: 28 } as const,
} as const;

export const EASE = {
  /** Apple-style "ease-out" — giriş animasyonlarının büyük çoğunluğu (24 kullanım). */
  out: [0.16, 1, 0.3, 1] as const,
  in: [0.4, 0, 1, 1] as const,
} as const;

export const DURATION = {
  instant: 0.12,
  fast: 0.2,
  normal: 0.32,
  slow: 0.5,
} as const;

/** Sayfa/sekme içeriği geçişi için hazır bir `motion.div` transition objesi. */
export const pageTransition = { duration: DURATION.slow, ease: EASE.out } as const;
