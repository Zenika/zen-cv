import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const companies = (page: Page) => page.locator('.experience-card__company')

test('lists the CVs and opens one', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Les CV' })).toBeVisible()
  await expect(page.getByText('Connecté en tant que Dev')).toBeVisible()
  await page.getByRole('link', { name: /Camille Martin/i }).click()

  await expect(page).toHaveURL('/cv/camille-martin')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Camille\s+Martin/i)

  await page.getByRole('link', { name: '← Tous les CV' }).click()
  await expect(page).toHaveURL('/')
})

test('edits the title', async ({ page }) => {
  await page.goto('/cv/camille-martin')
  await page.getByRole('button', { name: 'Modifier le titre' }).click()
  await page.getByRole('textbox', { name: 'Titre du CV' }).fill('Architecte Cloud')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('.cv-header__title')).toHaveText('Architecte Cloud')

  await page.reload()
  await expect(page.locator('.cv-header__title')).toHaveText('Architecte Cloud')
})

test('adds an experience, then deletes it', async ({ page }) => {
  await page.goto('/cv/camille-martin')
  await page.getByRole('button', { name: 'Ajouter une expérience' }).click()
  await page.getByPlaceholder('Entreprise').fill('Société E2E')
  await page.getByLabel('Poste').fill('Tech lead')
  await page.getByLabel('Période').fill('depuis 2026')
  await page.getByLabel('Contexte du projet').fill('Tests de bout en bout.')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(companies(page).first()).toHaveText('Société E2E')

  await page.reload()
  await expect(companies(page).first()).toHaveText('Société E2E')

  await page.getByRole('button', { name: "Supprimer l'expérience Société E2E" }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(companies(page)).not.toContainText(['Société E2E'])

  await page.reload()
  await expect(companies(page).first()).toHaveText('Banque Horizon')
})

test('reorders the experiences with the keyboard', async ({ page }) => {
  await page.goto('/cv/camille-martin')
  await expect(companies(page)).toHaveText(['Banque Horizon', 'TransLogis', 'Mutuelle Atlantique'])

  await page.locator('.experience-card').first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(companies(page)).toHaveText(['TransLogis', 'Banque Horizon', 'Mutuelle Atlantique'])
  await expect(page.locator('.experience-card').nth(1)).toBeFocused()

  await page.reload()
  await expect(companies(page)).toHaveText(['TransLogis', 'Banque Horizon', 'Mutuelle Atlantique'])

  await page.locator('.experience-card').nth(1).focus()
  await page.keyboard.press('ArrowUp')
  await expect(companies(page)).toHaveText(['Banque Horizon', 'TransLogis', 'Mutuelle Atlantique'])
})

test('exports the CV as a PDF', async ({ page }) => {
  await page.goto('/cv/camille-martin')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PDF' }).click()
  await expect(page.getByRole('button', { name: 'Export en cours…' })).toBeDisabled()

  const download = await downloading
  expect(download.suggestedFilename()).toBe('cv-camille-martin.pdf')
  const pdf = await readFile((await download.path())!)
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  await expect(page.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
})

test('explains why an unknown CV cannot be loaded', async ({ page }) => {
  await page.goto('/cv/inconnu')
  await expect(page.getByRole('alert')).toContainText("Le CV n'a pas pu être chargé")
  await expect(page.getByRole('alert')).toContainText('inconnu')
})
