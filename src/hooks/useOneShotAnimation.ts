import { useEffect, useState } from 'react';
import { useChangeKey } from './useChangeKey';

// Modül ömrü boyunca kalıcı — bir bileşen tipi sayfa içinde bir kez
// animasyonla girdikten sonra (örn. sekme değişip geri dönüldüğünde)
// tekrar giriş animasyonu oynatmaz. Anahtar başına bağımsızdır.
const animatedKeys = new Set<string>();

/**
 * İlk mount'ta giriş animasyonu oynatılmasını, sonraki mount'larda
 * (aynı oturum içinde) atlanmasını sağlar. `shouldAnimate` başlangıçta
 * `key`'e göre hesaplanır ve `key` DEĞİŞTİĞİNDE (bkz. `useChangeKey`)
 * yeniden hesaplanır — önceden yalnızca mount anındaki lazy initializer'a
 * bağlıydı, bu yüzden bir bileşen mount'tan SONRA farklı bir `key` alırsa
 * (aynı bileşen örneği yeniden kullanılıp farklı bir öğe için render
 * edilirse) `shouldAnimate` hiç güncellenmiyordu — ama aşağıdaki effect
 * yine de yeni key'i "animasyonlandı" işaretliyordu, bu da o key'i
 * kullanan BİR SONRAKİ gerçek mount'un giriş animasyonunu hiç
 * oynatmamasına yol açıyordu (düşük öncelikli bulgu).
 */
export function useOneShotAnimation(key: string): boolean {
  const [shouldAnimate, setShouldAnimate] = useState(() => !animatedKeys.has(key));

  if (useChangeKey(key)) {
    setShouldAnimate(!animatedKeys.has(key));
  }

  useEffect(() => {
    animatedKeys.add(key);
  }, [key]);

  return shouldAnimate;
}
