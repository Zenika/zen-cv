import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { buildPdf } from '../server/__tests__/buildPdf.ts'

const listedJeanne = (page: import('@playwright/test').Page) =>
  page.locator('.home__list').getByRole('link', { name: /Jeanne Leroy/i })

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
  await expect(listedJeanne(page)).toContainText('Mon CV')
  await expect(welcome(page)).toBeHidden()
})

test('lets a user claim an existing CV bearing their name', async ({ page }) => {
  await page.goto('/cv/jeanne-leroy')
  await page.getByRole('button', { name: 'Supprimer le CV' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page).toHaveURL('/')

  await page.getByText('Importer un PDF').setInputFiles({
    name: 'cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(buildPdf([[{ x: 23, y: 45, size: 24, text: 'Jeanne LEROY' }]])),
  })
  await expect(page).toHaveURL('/cv/jeanne-leroy')

  await page.goto('/')
  await expect(listedJeanne(page)).not.toContainText('Mon CV')
  await expect(welcome(page)).toContainText('Est-ce le vôtre ?')
  await welcome(page).getByRole('button', { name: "C'est mon CV" }).click()
  await expect(welcome(page)).toBeHidden()
  await expect(listedJeanne(page)).toContainText('Mon CV')
})
