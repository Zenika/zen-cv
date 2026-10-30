import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { e2eDatabaseUrl } from './e2e/database.ts'

const { TEST_DATABASE_URL } = loadEnv('test', process.cwd(), 'TEST_')
if (!TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL est absent : les tests e2e ont besoin d’une base de test (voir .env.example).',
  )
}

const port = 4173

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build-only && node e2e/prepare-db.ts && node server/index.ts',
    url: `http://localhost:${port}/api/cvs`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(port),
      DATABASE_URL: e2eDatabaseUrl(TEST_DATABASE_URL),
      DEV_USER_EMAIL: 'jeanne.leroy@zenika.com',
    },
  },
})
