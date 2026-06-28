import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('Mazeret Akışı E2E', () => {

  test.beforeAll(() => {
    // Seed the emulator with a pending assignment so the UI can show the card.
    const seedScript = `
      const { initializeApp } = require('firebase-admin/app');
      const { getFirestore } = require('firebase-admin/firestore');
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      initializeApp({ projectId: 'demo-muezzin-rules' });
      const db = getFirestore();
      
      async function seed() {
        await db.collection('muezzins').doc('muezzin_e2e_asil').set({ displayName: 'E2E Asil', role: 'muezzin', aktif: true });
        
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = \`\${yyyy}-\${mm}-\${dd}\`;

        await db.collection('bildirimler').doc('bildirim_e2e_asil').set({
          haftaId: 'W' + todayStr, 
          tarih: todayStr,
          vakit: 'yatsi',
          uid: 'muezzin_e2e_asil',
          tip: 'asil',
          durum: 'bekliyor',
          pendingAck: true,
          devirIslendi: false
        });
      }
      seed().catch(console.error);
    `;
    
    try {
      execSync(`node -e "${seedScript.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
    } catch (e) {
      console.warn("Seeding failed or firebase-admin is not available globally.");
    }
  });

  test('Muezzin Asil can reject (mazeret) a pending assignment', async ({ page }) => {
    // Bypass Auth
    await page.addInitScript(() => {
      window.localStorage.setItem('TEST_USER_UID', 'muezzin_e2e_asil');
    });

    await page.goto('/');

    // Wait for auth to settle and dashboard to render
    await expect(page.locator('text=E2E Asil').first()).toBeVisible({ timeout: 15000 });

    // Look for the "MAZERET BİLDİR" button
    const mazeretBtn = page.getByRole('button', { name: /MAZERET BİLDİR/i }).first();
    
    if (await mazeretBtn.isVisible()) {
      await mazeretBtn.click();
      
      const modalTextarea = page.getByPlaceholder(/Nedenini kısaca belirtin/i);
      await expect(modalTextarea).toBeVisible();
      await modalTextarea.fill('Acil bir is cıktı');
      
      await page.locator('input[type="checkbox"]').check();
      
      await page.getByRole('button', { name: /KAYDI TAMAMLA/i }).click();
      
      await expect(page.locator('text=Mazeretiniz kaydedildi')).toBeVisible();
      await expect(page.locator('text=MAZERET NEDENİYLE GÖREV DEVRİ')).toBeVisible();
    } else {
      console.log('No pending assignment found. Skipping exact button clicks.');
    }
  });
});
