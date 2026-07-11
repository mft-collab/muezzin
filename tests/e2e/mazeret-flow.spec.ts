import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Mazeret Akışı E2E', () => {
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
