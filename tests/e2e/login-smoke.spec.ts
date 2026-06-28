import { expect, test } from '@playwright/test';

test('login shell renders without runtime errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');

  await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  await expect(page.locator('body')).toContainText(/Hizmet|Google/i);

  expect(consoleErrors.filter((error) => !error.includes('ERR_BLOCKED_BY_CLIENT'))).toEqual([]);
});
