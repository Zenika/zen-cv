import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { buildPdf } from '../server/__tests__/buildPdf.ts'

const zenikaPdf = buildPdf([
  [
    { x: 23, y: 45, size: 24, text: 'Alice MARTEAU' },
    { x: 23, y: 70, size: 16, text: 'Consultante DevOps' },
    { x: 26, y: 110, size: 11, text: "Passionnée par l'automatisation." },
    { x: 26, y: 200, size: 11, text: 'Expertises' },
    { x: 230, y: 200, size: 11, text: 'Certifications' },
    { x: 26, y: 230, size: 11, text: 'Kubernetes : Expert' },
    { x: 230, y: 230, size: 11, text: 'Terraform Associate' },
    { x: 32, y: 400, size: 22, text: 'EXPÉRIENCES' },
    { x: 120, y: 440, size: 14, text: 'Société Import' },
    { x: 194, y: 440, size: 11, text: 'Tech lead (depuis 2024)' },
    { x: 194, y: 480, size: 11, text: 'Migration vers le cloud.' },
    { x: 48, y: 600, size: 22, text: 'FORMATION' },
    { x: 194, y: 620, size: 11, text: '2015 IUT de Nantes - DUT Informatique' },
  ],
])

test('imports a CV from a PDF and opens it with the points to check', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Importer un PDF').setInputFiles({
    name: 'cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(zenikaPdf),
  })

  await expect(page).toHaveURL('/cv/alice-marteau')
  await expect(page.getByRole('status')).toContainText('CV importé depuis le PDF.')
  await expect(page.getByRole('status')).toContainText('Section « Langues » introuvable.')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Alice\s+Marteau/i)
  await expect(page.locator('.experience-card__company')).toHaveText(['Société Import'])
  await expect(page.getByText('Terraform Associate')).toBeVisible()

  await page.getByRole('button', { name: 'Fermer' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)

  await page.getByRole('button', { name: 'Supprimer le CV' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Supprimer définitivement le CV de Alice Marteau ?')
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: 'Supprimer le CV' }).click()
  await dialog.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: /Alice Marteau/i })).toHaveCount(0)
  await page.goto('/cv/alice-marteau')
  await expect(page.getByRole('alert')).toContainText('alice-marteau')
})

test('explains why a file cannot be imported', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Importer un PDF').setInputFiles({
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('pas un PDF'),
  })
  await expect(page.getByRole('alert')).toContainText('le fichier envoyé n’est pas un PDF.')
  await expect(page).toHaveURL('/')
})
