# CLAUDE.md

Bu dosya, bu repoda çalışan bir AI ajanının (veya yeni bir geliştiricinin) ilk 10
dakikada bilmesi gereken şeyleri özetler: proje ne, tasarım sistemi nasıl işliyor,
hangi kalıplar kasıtlı, hangi komutlar neyi doğruluyor.

## Proje

Bir cami/müezzin ekibi için nöbet çizelgeleme PWA'sı. Vite + React 19 + TypeScript +
Firebase (Auth/Firestore/Messaging) + Zustand + Tailwind CSS v4 + `motion/react`
(Framer Motion). Offline-first: Firestore `persistentLocalCache` ile PWA modunda
bağlantısız çalışabiliyor (`src/lib/firebase.ts`).

Dizin yapısı:
- `src/pages` — rota bileşenleri (`admin/modules/*` admin paneli sekmeleri,
  kalan `pages/*` müezzin tarafı ekranları).
- `src/components` — paylaşılan UI bileşenleri (`components/ui/*`).
- `src/hooks`, `src/store` (Zustand), `src/services` (Firestore yazma/okuma),
  `src/lib` (saf yardımcılar: tarih, planlama çekirdeği, firebase init),
  `src/utils`.

## Tasarım sistemi

### Köşe yarıçapı: `rounded-card`

Uygulama genelinde "ana kart" katmanı (dashboard kartları, admin panel kartları,
modal/login/boş-durum kartları) tek bir standarda oturur: **40px**. Bu,
`src/index.css`'teki `@theme` bloğunda bir Tailwind v4 token'ı:

```css
--radius-card: 40px;
```

Bu otomatik olarak `rounded-card` (ve `!rounded-card` important varyantı) utility
sınıflarını üretir. **Yeni bir "ana kart" eklerken `rounded-[40px]` yazma —
`rounded-card` kullan.** Değer değişirse tek satır (`--radius-card`) güncellenir,
44+ dosyada arama-değiştirme gerekmez. Küçük katman öğeleri (butonlar, ikon
daireleri, rozetler, toast'lar, nav chrome, tablo hücreleri, iç içe alt kartlar)
bu standarda dahil değildir — onlar kendi ölçeğinde kalır (`rounded-[14px]`,
`rounded-[24px]` vb. hâlâ meşru).

### `.spatial-glass` ailesi

`.spatial-glass` (`src/index.css`), tüm kartların temel katmanıdır: cam efektli
arka plan (`--spatial-glass-bg`, temaya göre değişir), kenarlık, gölge. Üzerine
inşa eden varyantlar hiçbiri köşe yarıçapını override etmez, hepsi
`--radius-card`'ı miras alır:
- `.apple-card`, `.apple-card-elevated`, `.apple-card-flat`,
  `.apple-card-flat-active` — hover/aktif durumları farklılaşan kart varyantları.
- `.spatial-glass-elevated`, `.spatial-glass-flat` — gölge/yükseklik varyantları.
- `.tactile-card` — dokunma geri bildirimi olan (basılabilir) kartlar.

### Aura / circadian renk sistemi

Beş isimli "aura" rengi (`--aura-ruby`, `--aura-amber`, `--aura-emerald`,
`--aura-indigo`, `--aura-rose`) hem light hem dark temada ayrı ayrı ayarlanmış
hue/saturation/lightness değerleriyle tanımlı (`src/index.css` `@theme` ve
`[data-theme='light']`/`[data-theme='dark']` blokları). `--dynamic-aura` CSS
değişkeni, güncel vakte/duruma göre bu beşliden birine bağlanır (bkz.
`src/hooks/useAuraColors.ts`) — bileşenler doğrudan `var(--aura-indigo)` yerine
genellikle `var(--dynamic-aura, var(--aura-indigo))` fallback deseniyle yazar,
böylece "dinamik aura henüz hesaplanmadıysa" bile sabit bir renge düşer.

### Tipografi

`--text-2xs` (`0.6875rem`), standart Tailwind ölçeğinde olmayan ama uygulama
genelinde (etiketler, `authority-title` sınıfı) 400+ kez kullanılan bir boyut
olduğu için `@theme`'e token olarak eklendi — `rounded-card` ile aynı gerekçe:
tekrar eden bir arbitrary value, tek bir isimlendirilmiş token'a taşındı.

## Mimari kalıplar

### "Render sırasında state senkronu" — kasıtlı, anti-pattern DEĞİL

Bu kod tabanında sık görülen bir desen:

```ts
const [last, setLast] = useState(deger);
if (deger !== last) {
  setLast(deger);
  // ... state resetini/senkronunu burada yap
}
```

Bu React'in resmi dokümante ettiği "adjusting state when a prop changes"
desenidir (react.dev/learn/you-might-not-need-an-effect). Bir `useEffect` +
ekstra render turu yerine, prop/kaynak değiştiğinde state'i doğrudan render
sırasında günceller. **Bunu bir bug ya da anti-pattern olarak flagleme** — bu
kalıp bu projede birçok yerde bilinçli olarak kullanılıyor. Ortak parçası
`src/hooks/useChangeKey.ts`'e çıkarıldı (`key !== last` karşılaştırmasını ve
state güncellemesini tek satırda yapar); yeni bir yerde bu deseni yazman
gerekirse önce `useChangeKey` kullanılabilir mi diye bak.

### Planlama çekirdeği

`src/lib/planlamaCekirdegi.ts` (`haftalikPlanUret`) haftalık nöbet atamasının
**tek** saf (yan etkisiz) kaynağıdır — hem gece cron'u
(`scripts/haftalikPlanOlustur.ts`) hem istemci "self-healing" servisi
(`src/services/planServisi.ts`) bunu çağırır. Atama kuralları (onaylı izin/sabit
haftalık izin gününde asla atama yok, haftalık yük dengesi, Cuma vakitleri 1.5x
ağırlıklı + ayrıca `aylikCumaSayisi` üzerinden kalıcı bir adalet kademesi, yedek
görevi asil'in yarısı (`YEDEK_YUK_CARPANI=0.5`) kadar yük sayılır, art arda
dinlenme kuralı) yalnızca burada ve `src/utils/tieBreaker.ts`
(`tieBreakerSirala`) içinde tanımlı. Dinlenme kuralı (SOS) hafta sınırında
sıfırlanmasın diye `haftalikPlanUret`'in 5. parametresi
(`oncekiHaftaSonEkibi`) bir önceki haftanın Pazar/yatsı ekibiyle
beslenir — çağıran taraf bunu `src/lib/dateUtils.ts`'teki `getOncekiHafta`
ile hesaplar. `tekKisiliGunleriBul(gunPlan)`, yedeksiz (tek kişilik) kalan
günleri tespit eder; çağıranlar bunun için bir `adminUyarilari` kaydı açar.
Bu dosyaları değiştirirken `tests/unit/planlamaCekirdegi.test.ts` ve
`tests/unit/tieBreaker.test.ts`'i çalıştır — planlama mantığının tek test
kapsamı bunlar.

### Mazeret / Cuma kısıtlaması

`src/lib/mazeretKurallari.ts` (`mazeretKapaliMi`) mazeret/görev devri
penceresinin saf karar fonksiyonudur: Cuma günleri (asil veya yedek fark
etmeksizin) her zaman kapalı, sabah vakti önceki günün yatsısına göre kapanır,
diğer vakitler ezandan 1 saat öncesine kadar açık. Bu kısıtlama üç yerde ayrıca
uygulanır — birini değiştirirken diğerlerini unutma:
- `src/services/mazeretServisi.ts` (`mazeretBildir`) — istemci tarafı, hem
  asil hem yedek için.
- `firestore.rules` `isSelfBildirimUpdate()` — sunucu tarafı, bildirim
  belgesindeki `cumaMi` alanına bakar (oluşturma anında hesaplanır, opsiyonel
  alan — eski belgelerde olmayabilir).
- `firestore.rules` `isValidVekaletCreate`/`isAcceptedVekaletBildirimTransfer`
  ve `src/services/vekaletServisi.ts` — vekalet (gönüllü görev devri) de aynı
  Cuma kısıtlamasına tabi, aksi halde mazeret engelini bu yoldan atlatmak
  mümkün olurdu (bkz. algoritma denetimi).

### Firestore dinleyici deseni

Gerçek-zamanlı veri gereken yerlerde `onSnapshot`, tek seferlik okuma yeterli
olan yerlerde `getDocs`/`getDoc` kullanılır (bkz. `useDuyurular.ts`). Bir hook
"neden bu veri canlı değil" sorusuna cevap veremiyorsa muhtemelen bug'dır.

## Komutlar

```bash
npm run dev              # vite --port=3000 (Playwright bu portu bekliyor, değiştirme)
npm run typecheck        # tsc --noEmit
npm run lint              # eslint .
npm run build             # production build
npm run test:unit         # vitest (tests/unit/**/*.test.{ts,tsx})
npm run test:e2e          # playwright (Firebase emülatörü gerektirir)
npm run test:rules        # firestore.rules testleri (emülatör)
npm run test:all           # typecheck + lint + smoke + unit + rules + sw-config
```

Bir değişiklikten sonra en az `typecheck && lint && build && test:unit`
çalıştır; commit'ten önce mümkünse `test:all`.

## Bundle bölme

`vite.config.ts`'teki `manualChunks`, Firebase'i üç ayrı chunk'a böler:
`vendor-firebase-auth` (login gate'te hemen gerekli), `vendor-firebase`
(Firestore + core, daha büyük), `vendor-firebase-messaging` (boot sonrası lazy
yüklenir). Yeni bir Firebase alt-paketi eklersen bu ayrımı bozmadan (yani hangi
chunk'a düşeceğini bilerek) ekle.
