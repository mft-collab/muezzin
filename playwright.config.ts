import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // CI runner'ında dev server + 2 Firestore/Auth emülatörü + Chromium ile
  // aynı anda çalışırken paralel worker'lar arasındaki kaynak çekişmesi
  // (CPU/ağ) flaky zaman aşımlarına yol açıyordu. Bu küçük test setinde
  // hız kaybı ihmal edilebilir, kararlılık daha değerli.
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: process.platform === 'win32' ? 'npm.cmd run dev' : 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    // E2E testleri production Firestore/Auth'a değil, yerel emülatörlere
    // karşı çalışsın (bkz. src/lib/firebase.ts, tests/e2e/seed-mazeret.ts).
    // Emülatörlerin de `firebase emulators:start --only firestore,auth`
    // ile ayrıca çalışıyor olması gerekir (bkz. .github/workflows/test.yml).
    env: {
      VITE_USE_EMULATOR: '1'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    }
  ]
});
