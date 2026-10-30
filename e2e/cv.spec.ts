import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const companies = (page: Page) => page.locator('.experience-card__company')

test('lists the CVs and opens one', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Les CV' })).toBeVisible()
  await expect(page.getByText('Connecté en tant que Jeanne Leroy')).toBeVisible()
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

test('refuses to overwrite a change made in another window', async ({ browser }) => {
  const [mine, theirs] = await Promise.all([browser.newPage(), browser.newPage()])
  await mine.goto('/cv/raphael-grand')
  await theirs.goto('/cv/raphael-grand')

  async function editBio(page: Page, bio: string) {
    await page.getByRole('button', { name: 'Modifier la bio' }).click()
    await page.getByRole('textbox', { name: 'Bio' }).fill(bio)
    await page.getByRole('button', { name: 'Enregistrer' }).click()
  }

  await editBio(theirs, 'Bio enregistrée par l’autre fenêtre.')
  await expect(theirs.locator('.cv-page__bio-text')).toHaveText(
    'Bio enregistrée par l’autre fenêtre.',
  )

  await editBio(mine, 'Bio écrite sans voir l’autre modification.')
  const alert = mine.getByRole('alert')
  await expect(alert).toContainText('modifié par quelqu’un d’autre')
  await alert.getByRole('button', { name: 'Recharger le CV' }).click()
  await expect(mine.locator('.cv-page__bio-text')).toHaveText(
    'Bio enregistrée par l’autre fenêtre.',
  )

  await editBio(mine, 'Bio enregistrée après rechargement.')
  await expect(mine.getByRole('alert')).toHaveCount(0)
  await theirs.reload()
  await expect(theirs.locator('.cv-page__bio-text')).toHaveText(
    'Bio enregistrée après rechargement.',
  )
  await Promise.all([mine.close(), theirs.close()])
})

test('searches the CVs by name and keeps the search when coming back', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('.home__list').getByRole('link')
  await expect(cards).toHaveText([/Raphaël\s+Grand/i, /Camille\s+Martin/i])

  const search = page.getByRole('searchbox', { name: 'Rechercher un CV par nom' })
  await search.pressSequentially('cam')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('cam')
  await expect(cards).toHaveText([/Camille\s+Martin/i])
  await expect(page).toHaveURL('/?q=cam')

  await cards.first().click()
  await expect(page).toHaveURL('/cv/camille-martin')
  await page.goBack()
  await expect(page.getByRole('searchbox', { name: 'Rechercher un CV par nom' })).toHaveValue('cam')
  await expect(cards).toHaveText([/Camille\s+Martin/i])

  await page.getByRole('searchbox', { name: 'Rechercher un CV par nom' }).fill('personne')
  await expect(page.getByText('Aucun CV ne correspond à « personne ».')).toBeVisible()
})

test('creates a labelled version of a CV, kept off the printed CV', async ({ page }) => {
  await page.goto('/cv/camille-martin')
  await page.getByRole('button', { name: 'Nouvelle version' }).click()
  await page.getByLabel(/Label de la nouvelle version/).fill('Mission Banque')
  await page.getByRole('button', { name: 'Créer' }).click()

  await expect(page).toHaveURL('/cv/camille-martin-v2')
  const versions = page.getByRole('navigation', { name: 'Versions du CV' })
  await expect(versions.locator('[aria-current="page"]')).toHaveText('Mission Banque')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Camille\s+Martin/i)

  await page.emulateMedia({ media: 'print' })
  await expect(versions).toBeHidden()
  await expect(page.getByText('Mission Banque')).toBeHidden()
  await page.emulateMedia({ media: 'screen' })

  await page.goto('/')
  await expect(
    page.locator('.home__list').getByRole('link', { name: /Camille Martin/i }),
  ).toHaveCount(1)

  await page.goto('/cv/camille-martin-v2')
  await page.getByRole('button', { name: 'Supprimer la version' }).click()
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
  await expect(page).toHaveURL('/cv/camille-martin')
  await expect(versions.getByRole('listitem')).toHaveCount(1)
})
