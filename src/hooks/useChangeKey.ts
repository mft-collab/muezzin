import { useState } from 'react';

/**
 * Bir anahtar değeri render sırasında önceki değeriyle karşılaştırır ve
 * değiştiyse true döner — çağıran taraf bu durumda kendi state resetini/
 * senkronunu render içinde çalıştırır (React'in resmi "prop değişince state
 * ayarla" deseni, bkz. react.dev/learn/you-might-not-need-an-effect#adjusting-
 * some-state-when-a-prop-changes). Bu proje boyunca aynı üç satır (useState +
 * karşılaştır + kaydet) birçok hook'ta tekrarlandığı için buraya taşındı.
 */
export function useChangeKey<T>(key: T): boolean {
  const [last, setLast] = useState(key);
  const changed = key !== last;
  if (changed) setLast(key);
  return changed;
}
