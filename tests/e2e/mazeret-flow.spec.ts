import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * seed-mazeret.ts her zaman BUGÜN için bir görev seed eder ("Kişisel
 * Görevlerim" ekranı yalnızca bugünün görevlerini gösterdiğinden başka bir
 * gün seçilemez — bkz. useBugunkuGorevlerim.ts). mazeretKurallari.ts'teki
 * kural ise Cuma günleri mazeret bildirimini asil/yedek fark etmeksizin HER
 * ZAMAN kapatır (bkz. CLAUDE.md "Mazeret / Cuma kısıtlaması"). Bu ikisi bir
 * araya gelince: bu test her Cuma günü, production kodunda hiçbir hata
 * olmadan, salt kuralın doğru çalışması yüzünden "KAYDI TAMAMLA" adımında
 * başarısız oluyordu (bkz. E2E flakiness soruşturması). Kalıcı çözüm için
 * seed'in başka bir günü hedeflemesi mümkün değil (görev bugün olmak
 * zorunda) — bu yüzden akış yalnızca Cuma günleri atlanıyor.
 */
function turkeyIsFridayNow(): boolean {
  const turkeyMs = Date.now() + 3 * 60 * 60 * 1000; // UTC+3 sabit ofset (bkz. seed-mazeret.ts turkeyTodayStr)
  return new Date(turkeyMs).getUTCDay() === 5; // 0=Pazar ... 5=Cuma
}

test.describe('Mazeret Akışı E2E', () => {
  test.skip(turkeyIsFridayNow(), 'Mazeret bildirimi Cuma günleri kural gereği her zaman kapalı — seed bugün için görev oluşturduğundan bu akış Cuma günü test edilemez.');

  let customToken: string;

  test.beforeAll(() => {
    // Emülatörleri seed'ler ve gerçek bir Firebase Auth custom token üretir.
    // (Bu test yalnızca VITE_USE_EMULATOR=1 ile başlatılan bir dev server'a
    // ve çalışan firestore+auth emülatörlerine karşı anlamlıdır — bkz.
    // playwright.config.ts ve .github/workflows/test.yml.)
    customToken = execFileSync(
      'npx',
      ['tsx', path.join(__dirname, 'seed-mazeret.ts')],
      { encoding: 'utf8', shell: process.platform === 'win32' }
    ).trim();
  });

  test('Muezzin Asil can reject (mazeret) a pending assignment', async ({ page }) => {
    await page.goto('/');

    // Gerçek bir Firebase Auth oturumu aç (emülatöre karşı) — window.__testSignIn
    // yalnızca VITE_USE_EMULATOR=1 iken src/lib/firebase.ts tarafından set edilir.
    await page.waitForFunction(() => (window as any).__testSignIn !== undefined, { timeout: 15000 });
    await page.evaluate((token) => (window as any).__testSignIn(token), customToken);

    // Auth ve dashboard'un yerleşmesini bekle (seed edilen asil görev kartı)
    await expect(page.getByText(/YATSI vakti - Asil görev/i).first()).toBeVisible({ timeout: 15000 });

    const mazeretBtn = page.getByRole('button', { name: /MAZERET BİLDİR/i }).first();
    await expect(mazeretBtn).toBeVisible({ timeout: 10000 });
    await mazeretBtn.click();

    const modalTextarea = page.getByPlaceholder(/Nedenini kısaca belirtin/i);
    await expect(modalTextarea).toBeVisible();
    await modalTextarea.fill('Acil bir is cıktı');

    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /KAYDI TAMAMLA/i }).click();

    await expect(page.locator('text=Mazeretiniz kaydedildi').first()).toBeVisible();
  });
});
