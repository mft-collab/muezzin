# CLAUDE.md

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
modal/login/boş-durum kartları) tek bir standarda oturur: **15px**. Bu,
`src/index.css`'teki `@theme` bloğunda bir Tailwind v4 token'ı:

```css
--radius-card: 15px;
```

**Yeni bir "ana kart" eklerken `rounded-[15px]` yazma — `rounded-card` kullan.**
Değer değişirse tek satır (`--radius-card`) güncellenir, 44+ dosyada
arama-değiştirme gerekmez. Küçük katman öğeleri (butonlar, ikon daireleri,
rozetler, toast'lar, nav chrome, tablo hücreleri, iç içe alt kartlar) bu
standarda dahil değildir — onlar kendi ölçeğinde kalır (`rounded-[14px]`,
`rounded-[24px]` vb. hâlâ meşru).

### `.spatial-glass` ailesi

`.spatial-glass` (`src/index.css`), tüm kartların temel katmanıdır: cam efektli
arka plan (`--spatial-glass-bg`, temaya göre değişir), kenarlık, gölge. Üzerine
inşa eden varyantlar (`.apple-card*`, `.spatial-glass-elevated/flat`,
`.tactile-card`) hiçbiri köşe yarıçapını override etmez, hepsi
`--radius-card`'ı miras alır.

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
olduğu için `@theme`'e token olarak eklendi — `rounded-card` ile aynı gerekçe.

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
- `firestore.rules` `isValidVekaletCreate` (talep oluşturma) ve
  `scripts/vekaletDevirleriniIsle.ts` (GERÇEK transfer — "1000 ifade tavanı"
  kök neden çözümü sonrası artık CEL'de değil, Admin SDK'da taze veriyle
  yeniden doğrulanıyor) ve `src/services/vekaletServisi.ts` — vekalet
  (gönüllü görev devri) de aynı Cuma kısıtlamasına tabi, aksi halde mazeret
  engelini bu yoldan atlatmak mümkün olurdu (bkz. algoritma denetimi).

### Firestore dinleyici deseni

Gerçek-zamanlı veri gereken yerlerde `onSnapshot`, tek seferlik okuma yeterli
olan yerlerde `getDocs`/`getDoc` kullanılır (bkz. `useDuyurular.ts`). Bir hook
"neden bu veri canlı değil" sorusuna cevap veremiyorsa muhtemelen bug'dır.

## Komutlar

```bash
npm run dev               # vite --port=3000 (Playwright bu portu bekliyor, değiştirme)
npm run typecheck         # tsc --noEmit
npm run lint               # eslint .
npm run build              # production build
npm run test:unit          # vitest (tests/unit/**/*.test.{ts,tsx})
npm run test:e2e           # playwright (Firebase emülatörü gerektirir)
npm run test:rules         # firestore.rules testleri (emülatör)
npm run test:integration   # admin-SDK uzlaştırma cron'ları (tests/integration, emülatör)
npm run test:all           # typecheck + typecheck:scripts + lint + smoke + unit + rules + integration + sw-config + indexes
```

**`npm test` `test:all`'ın takma adı DEĞİL** — sadece `test:smoke`'u çalıştırır.
Tam doğrulama için `npm run test:all` kullan.

## Bundle bölme

`vite.config.ts`'teki `manualChunks`, Firebase'i üç ayrı chunk'a böler:
`vendor-firebase-auth` (login gate'te hemen gerekli), `vendor-firebase`
(Firestore + core, daha büyük), `vendor-firebase-messaging` (boot sonrası lazy
yüklenir). Yeni bir Firebase alt-paketi eklersen bu ayrımı bozmadan (yani hangi
chunk'a düşeceğini bilerek) ekle.

## Model Seçimi (Claude Pro — verimli kullanım)

Varsayılan Sonnet. Basit arama/keşif işlerinde Haiku yeterli. **Opus'a geç**
(`/model opus` veya Agent çağrısında `model: "opus"`):

- **Riskli kod**: `firestore.rules` (`isSelfBildirimUpdate`, `isValidVekaletCreate` —
  mazeret/vekalet Cuma kısıtlamasının sunucu tarafı zorlayıcısı), `src/lib/mazeretKurallari.ts`
  ve onunla senkron tutulması gereken üç uygulama noktası (`mazeretServisi.ts`,
  `vekaletServisi.ts`, `scripts/vekaletDevirleriniIsle.ts` — gerçek, geri dönüşü olmayan
  görev devri), `src/lib/planlamaCekirdegi.ts`/`tieBreaker.ts` (haftalık nöbet atamasının
  tek kaynağı, hem cron hem istemci bunu çağırır), `scripts/*.ts` altındaki zamanlanmış
  cron script'leri ve bunları tetikleyen `.github/workflows/*.yml` (haftalik-plan,
  gunluk-yatsi-sonu, mazeret-devirleri, aylik-ezan-takvimi, gunluk-log-temizligi,
  deploy.yml — public repo'da canlıya kendi başına deploy/yazan tetikleyiciler,
  bkz. kök otomasyon ayarlarındaki soft-deny listesi).
- **Planlama**: `mazeretKurallari.ts`/vekalet zincirindeki üç uygulama noktasından birini
  değiştirirken (diğer ikisini birlikte tasarlamak gerekir), ya da yeni bir zamanlanmış
  script/GitHub Actions workflow eklerken.
- **Doğrulama**: `firestore.rules`, planlama çekirdeği veya `scripts/` içindeki bir
  cron/transfer script'ine dokunduktan sonra `npm run test:all` yeşil olsa bile ikinci
  bir gözle geçir — özellikle Cuma kısıtlamasının üç uygulama noktasında hâlâ tutarlı
  olduğunu ve `scripts/vekaletDevirleriniIsle.ts`'in taze veriyle yeniden doğrulama
  mantığını bozmadığını kontrol et. Deploy komutunu (workflow tetikleme, `firebase deploy`)
  Claude kendi başına çalıştırmaz — bkz. kök otomasyon ayarları.
