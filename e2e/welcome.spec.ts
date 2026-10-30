import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { buildPdf } from '../server/__tests__/buildPdf.ts'

const welcome = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Bienvenue Jeanne Leroy !' })

test('lets a user without a CV put the import off', async ({ page }) => {
  await page.goto('/')
  await expect(welcome(page)).toContainText('Aucun CV à votre nom')
  await welcome(page).getByRole('button', { name: 'Plus tard' }).click()
  await expect(welcome(page)).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Les CV' })).toBeVisible()
  await expect(welcome(page)).toBeHidden()
})

test('imports the CV of a user without one, under the name of their account', async ({ page }) => {
  await page.goto('/')
  await welcome(page)
    .getByText('Importer mon CV (PDF)')
    .setInputFiles({
      name: 'cv.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(
        buildPdf([
          [
            { x: 23, y: 45, size: 24, text: 'JLE' },
            { x: 23, y: 70, size: 16, text: 'Tech lead Java' },
          ],
        ]),
      ),
    })

  await expect(page).toHaveURL('/cv/jeanne-leroy')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Jeanne\s+Leroy/i)
  await expect(page.getByRole('status')).toContainText(
    'Nom repris de votre compte : « Jeanne Leroy » (le PDF indiquait « JLE À compléter »).',
  )

  await page.goto('/')
  await expect(page.getByRole('link', { name: /Jeanne Leroy/i })).toBeVisible()
  await expect(welcome(page)).toBeHidden()
})
