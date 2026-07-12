import { useEffect, useState } from 'react';

// Modül ömrü boyunca kalıcı — bir bileşen tipi sayfa içinde bir kez
// animasyonla girdikten sonra (örn. sekme değişip geri dönüldüğünde)
// tekrar giriş animasyonu oynatmaz. Anahtar başına bağımsızdır.
const animatedKeys = new Set<string>();

/**
 * İlk mount'ta giriş animasyonu oynatılmasını, sonraki mount'larda
 * (aynı oturum içinde) atlanmasını sağlar. `shouldAnimate` bileşenin
 * tüm ömrü boyunca sabittir — sonraki re-render'larda değişmez, bu
 * yüzden mount sonrası eklenen öğeler de tutarlı davranır.
 */
export function useOneShotAnimation(key: string): boolean {
  const [shouldAnimate] = useState(() => !animatedKeys.has(key));

  useEffect(() => {
    animatedKeys.add(key);
  }, [key]);

  return shouldAnimate;
}
