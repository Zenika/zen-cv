import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Relation, UserData } from '../../shared/cv.ts'
import { createApp } from '../app.ts'
import type { Identity } from '../auth/identity.ts'
import type { ParsedCv } from '../import/parseCv.ts'
import { CvImportError } from '../services/errors.ts'
import { readSeed, seedFile } from '../db/seed.ts'
import type { CvRepository } from '../repository/cvRepository.ts'
import { createCvService } from '../services/cvService.ts'
import { createMemoryRepository } from './memoryRepository.ts'

let seedData: Record<string, UserData>
let repository: CvRepository
let app: ReturnType<typeof createApp>
let renderedIds: string[]
let parsed: ParsedCv | Error
let identity: Identity
let relations: Record<string, Relation[]>

function put(id: string, body: unknown, ifMatch: string | null = '"1"') {
  return app.request(`/api/cvs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(ifMatch && { 'If-Match': ifMatch }) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const stored = async (id: string) => (await repository.get(id))?.cv

beforeEach(async () => {
  seedData = await readSeed()
  repository = createMemoryRepository(seedData)
  renderedIds = []
  const pdfRenderer = {
    async render(id: string) {
      renderedIds.push(id)
      return new TextEncoder().encode('%PDF-fake')
    },
  }
  parsed = { cv: seedData['camille-martin']!, warnings: ['Bloc des compétences introuvable.'] }
  const pdfImporter = {
    async import() {
      if (parsed instanceof Error) throw parsed
      return structuredClone(parsed)
    },
  }
  identity = async () => ({ email: 'camille.martin@zenika.com', name: 'Camille Martin' })
  relations = {}
  app = createApp(
    createCvService(repository, pdfRenderer, pdfImporter, async (email) => relations[email] ?? []),
    (headers) => identity(headers),
  )
})

describe('authentication', () => {
  it('returns the signed-in user', async () => {
    const response = await app.request('/api/me')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      email: 'camille.martin@zenika.com',
      name: 'Camille Martin',
    })
  })

  it('refuses every API call without a signed-in user', async () => {
    identity = async () => null
    for (const [method, path] of [
      ['GET', '/api/me'],
      ['GET', '/api/cvs'],
      ['DELETE', '/api/cvs/camille-martin'],
      ['GET', '/api/inconnu'],
    ] as const) {
      const response = await app.request(path, { method })
      expect(response.status).toBe(401)
      expect(await response.text()).toBe(
        'authentification requise : rechargez la page pour vous reconnecter.',
      )
    }
    expect(await stored('camille-martin')).toEqual(seedData['camille-martin'])
  })
})

describe('seed data', () => {
  it('matches the CV schema without losing any field', async () => {
    const raw = JSON.parse(await readFile(seedFile, 'utf-8'))
    expect(isDeepStrictEqual(seedData, raw)).toBe(true)
  })
})

describe('GET /api/cvs', () => {
  it('lists CV summaries', async () => {
    const response = await app.request('/api/cvs')
    expect(response.status).toBe(200)
    expect(await response.json()).toContainEqual({
      id: 'camille-martin',
      firstname: 'Camille',
      name: 'Martin',
      title: 'Développeuse Backend Java & Cloud',
      ownerEmail: null,
    })
  })
})

describe('GET /api/cvs/:id', () => {
  it('returns the CV with its version as ETag', async () => {
    const response = await app.request('/api/cvs/camille-martin')
    expect(response.status).toBe(200)
    expect(response.headers.get('ETag')).toBe('"1"')
    expect(await response.json()).toEqual(seedData['camille-martin'])
  })

  it('answers 404 for an unknown CV', async () => {
    const response = await app.request('/api/cvs/inconnu')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('aucun CV ne correspond à « inconnu ».')
  })
})

const ownCamilleCv = () => repository.setOwner('camille-martin', 'camille.martin@zenika.com')

describe('PUT /api/cvs/:id', () => {
  beforeEach(ownCamilleCv)

  it('replaces the CV and returns its new version', async () => {
    const cv = { ...seedData['camille-martin']!, title: 'Architecte Cloud' }
    const response = await put('camille-martin', cv)
    expect(response.status).toBe(204)
    expect(response.headers.get('ETag')).toBe('"2"')
    expect(await stored('camille-martin')).toEqual(cv)
    expect((await app.request('/api/cvs/camille-martin')).headers.get('ETag')).toBe('"2"')
  })

  it('refuses to overwrite a change made since the CV was loaded', async () => {
    const cv = seedData['camille-martin']!
    await put('camille-martin', { ...cv, title: 'Première' })
    const response = await put('camille-martin', { ...cv, title: 'Seconde' }, '"1"')
    expect(response.status).toBe(412)
    expect(await response.text()).toBe(
      'ce CV a été modifié par quelqu’un d’autre depuis que vous l’avez ouvert. Rechargez-le pour voir ses modifications.',
    )
    expect((await stored('camille-martin'))!.title).toBe('Première')
  })

  it('requires the version of the CV being replaced', async () => {
    for (const ifMatch of [null, '*', 'W/"1"', '1']) {
      const response = await put('camille-martin', seedData['raphael-grand'], ifMatch)
      expect(response.status).toBe(428)
    }
    expect(await stored('camille-martin')).toEqual(seedData['camille-martin'])
  })

  it('drops unknown fields', async () => {
    const cv = seedData['camille-martin']!
    await put('camille-martin', { ...cv, unexpected: true })
    expect(await stored('camille-martin')).toEqual(cv)
  })

  it('rejects an invalid CV with the faulty field and keeps the data', async () => {
    const response = await put('camille-martin', { ...seedData['camille-martin']!, title: 42 })
    expect(response.status).toBe(400)
    expect(await response.text()).toContain('→ at title')
    expect(await stored('camille-martin')).toEqual(seedData['camille-martin'])
  })

  it('rejects malformed JSON', async () => {
    expect((await put('camille-martin', '{oops')).status).toBe(400)
  })

  it('answers 404 for an unknown CV without creating it', async () => {
    expect((await put('inconnu', seedData['camille-martin'])).status).toBe(404)
    expect(await stored('inconnu')).toBeUndefined()
  })
})

describe('edit permissions', () => {
  const editable = async (id: string) =>
    (await app.request(`/api/cvs/${id}`)).headers.get('Allow') === 'GET, PUT, DELETE'
  const as = (email: string, title?: string) => {
    identity = async () => ({ email, name: 'Quelqu’un', relations: [], ...(title && { title }) })
  }
  const saveTitle = () =>
    put('camille-martin', { ...seedData['camille-martin']!, title: 'Modifié' })

  beforeEach(ownCamilleCv)

  it('lets the owner edit their CV', async () => {
    as('Camille.Martin@zenika.com')
    expect(await editable('camille-martin')).toBe(true)
    expect((await saveTitle()).status).toBe(204)
  })

  it('lets the manager of the owner edit the CV', async () => {
    relations['camille.martin@zenika.com'] = [
      { value: 'assistant@zenika.com', type: 'assistant' },
      { value: 'Manager@zenika.com', type: 'manager' },
    ]
    as('manager@zenika.com')
    expect(await editable('camille-martin')).toBe(true)
    expect((await saveTitle()).status).toBe(204)
    as('assistant@zenika.com')
    expect(await editable('camille-martin')).toBe(false)
  })

  it.each(['Business Developer', 'Directeur d’agence', "directeur d'Agence"])(
    'lets a %s edit and delete any CV, even one nobody owns',
    async (title) => {
      as('jeanne.leroy@zenika.com', title)
      expect(await editable('camille-martin')).toBe(true)
      expect((await saveTitle()).status).toBe(204)
      expect(await editable('raphael-grand')).toBe(true)
      const response = await app.request('/api/cvs/raphael-grand', { method: 'DELETE' })
      expect(response.status).toBe(204)
    },
  )

  it('refuses everyone else, and keeps the CV', async () => {
    as('jeanne.leroy@zenika.com', 'Consultante')
    expect(await editable('camille-martin')).toBe(false)
    expect((await app.request('/api/cvs/camille-martin')).headers.get('Allow')).toBe('GET')
    const response = await saveTitle()
    expect(response.status).toBe(403)
    expect(await response.text()).toBe(
      'vous ne pouvez pas modifier ce CV : seuls son propriétaire, son manager, les Business Developers et les Directeurs d’agence le peuvent.',
    )
    expect((await app.request('/api/cvs/camille-martin', { method: 'DELETE' })).status).toBe(403)
    expect(await stored('camille-martin')).toEqual(seedData['camille-martin'])
  })

  it('refuses a CV nobody owns to all but Business Developers and Directeurs d’agence', async () => {
    expect(await editable('raphael-grand')).toBe(false)
    const response = await put('raphael-grand', seedData['raphael-grand'])
    expect(response.status).toBe(403)
  })
})

describe('versions', () => {
  const createVersion = (id: string, label: unknown) =>
    app.request(`/api/cvs/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
  const rename = (id: string, label: unknown) =>
    app.request(`/api/cvs/${id}/label`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
  const versions = async (id: string) => (await app.request(`/api/cvs/${id}/versions`)).json()

  beforeEach(ownCamilleCv)

  it('copies a CV under a label, as a version of the main CV', async () => {
    const response = await createVersion('camille-martin', '  Mission Banque  ')
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: 'camille-martin-v2' })
    expect(await stored('camille-martin-v2')).toEqual(seedData['camille-martin'])
    expect(await repository.get('camille-martin-v2')).toMatchObject({
      sourceId: 'camille-martin',
      label: 'Mission Banque',
      ownerEmail: null,
    })
  })

  it('copies a version with its changes, still attached to the main CV', async () => {
    await createVersion('camille-martin', 'Banque')
    await put('camille-martin-v2', { ...seedData['camille-martin']!, title: 'Architecte' })
    expect(await (await createVersion('camille-martin-v2', 'Assurance')).json()).toEqual({
      id: 'camille-martin-v3',
    })
    expect((await stored('camille-martin-v3'))!.title).toBe('Architecte')
    const expected = [
      { id: 'camille-martin', label: null },
      { id: 'camille-martin-v2', label: 'Banque' },
      { id: 'camille-martin-v3', label: 'Assurance' },
    ]
    expect(await versions('camille-martin')).toEqual(expected)
    expect(await versions('camille-martin-v3')).toEqual(expected)
  })

  it('lists only main CVs on the home page', async () => {
    await createVersion('camille-martin', 'Banque')
    const summaries: { id: string }[] = await (await app.request('/api/cvs')).json()
    expect(summaries.map(({ id }) => id)).toEqual(Object.keys(seedData))
  })

  it('gives versions the edit rights of the main CV', async () => {
    await createVersion('camille-martin', 'Banque')
    identity = async () => ({ email: 'jeanne.leroy@zenika.com', name: 'Jeanne Leroy' })
    expect((await app.request('/api/cvs/camille-martin-v2')).headers.get('Allow')).toBe('GET')
    expect((await createVersion('camille-martin-v2', 'Autre')).status).toBe(403)
    expect((await rename('camille-martin-v2', 'Autre')).status).toBe(403)
    expect(
      (await put('camille-martin-v2', { ...seedData['camille-martin']!, title: 'X' })).status,
    ).toBe(403)
    relations['camille.martin@zenika.com'] = [{ value: 'jeanne.leroy@zenika.com', type: 'manager' }]
    expect((await app.request('/api/cvs/camille-martin-v2')).headers.get('Allow')).toBe(
      'GET, PUT, DELETE',
    )
  })

  it('renames a version, never the main CV', async () => {
    await createVersion('camille-martin', 'Banque')
    expect((await rename('camille-martin-v2', 'Assurance')).status).toBe(204)
    expect((await repository.get('camille-martin-v2'))!.label).toBe('Assurance')
    const response = await rename('camille-martin', 'Principal')
    expect(response.status).toBe(409)
    expect(await response.text()).toBe('le CV principal n’a pas de label.')
  })

  it('requires a label', async () => {
    for (const label of ['', '   ', 42, 'x'.repeat(101)])
      expect((await createVersion('camille-martin', label)).status).toBe(400)
    expect(await versions('camille-martin')).toEqual([{ id: 'camille-martin', label: null }])
  })

  it('deletes the versions with the main CV, and a version alone', async () => {
    await createVersion('camille-martin', 'Banque')
    await createVersion('camille-martin', 'Assurance')
    await app.request('/api/cvs/camille-martin-v2', { method: 'DELETE' })
    expect(await versions('camille-martin')).toEqual([
      { id: 'camille-martin', label: null },
      { id: 'camille-martin-v3', label: 'Assurance' },
    ])
    await app.request('/api/cvs/camille-martin', { method: 'DELETE' })
    expect(await stored('camille-martin-v3')).toBeUndefined()
  })

  it('refuses to give a version its own owner', async () => {
    await createVersion('camille-martin', 'Banque')
    const response = await app.request('/api/cvs/camille-martin-v2/claim', { method: 'POST' })
    expect(response.status).toBe(409)
  })

  it('answers 404 for an unknown CV', async () => {
    expect((await createVersion('inconnu', 'Banque')).status).toBe(404)
    expect((await app.request('/api/cvs/inconnu/versions')).status).toBe(404)
  })
})

describe('POST /api/cvs/:id/claim', () => {
  const claim = (id: string) => app.request(`/api/cvs/${id}/claim`, { method: 'POST' })

  it('makes me the owner of a CV nobody owns', async () => {
    identity = async () => ({ email: 'Camille.Martin@zenika.com', name: 'Camille MARTIN' })
    expect((await claim('camille-martin')).status).toBe(204)
    expect((await repository.get('camille-martin'))!.ownerEmail).toBe('camille.martin@zenika.com')
    const summaries: { id: string; ownerEmail: string | null }[] = await (
      await app.request('/api/cvs')
    ).json()
    expect(summaries.find(({ id }) => id === 'camille-martin')!.ownerEmail).toBe(
      'camille.martin@zenika.com',
    )
  })

  it('refuses a CV someone already owns', async () => {
    await claim('camille-martin')
    identity = async () => ({ email: 'jeanne.leroy@zenika.com', name: 'Jeanne LEROY' })
    const response = await claim('camille-martin')
    expect(response.status).toBe(409)
    expect(await response.text()).toBe('ce CV appartient déjà à quelqu’un d’autre.')
    expect((await repository.get('camille-martin'))!.ownerEmail).toBe('camille.martin@zenika.com')
  })

  it('refuses a second CV for the same person', async () => {
    await claim('camille-martin')
    const response = await claim('raphael-grand')
    expect(response.status).toBe(409)
    expect((await repository.get('raphael-grand'))!.ownerEmail).toBeNull()
  })

  it('answers 404 for an unknown CV', async () => {
    expect((await claim('inconnu')).status).toBe(404)
  })

  it('keeps the owner when the CV is saved', async () => {
    await claim('camille-martin')
    await put('camille-martin', { ...seedData['camille-martin']!, title: 'Architecte' })
    expect((await repository.get('camille-martin'))!.ownerEmail).toBe('camille.martin@zenika.com')
  })
})

describe('DELETE /api/cvs/:id', () => {
  beforeEach(ownCamilleCv)

  it('deletes the CV', async () => {
    const response = await app.request('/api/cvs/camille-martin', { method: 'DELETE' })
    expect(response.status).toBe(204)
    expect(await stored('camille-martin')).toBeUndefined()
    expect(await stored('raphael-grand')).toEqual(seedData['raphael-grand'])
  })

  it('answers 404 for an unknown CV', async () => {
    const response = await app.request('/api/cvs/inconnu', { method: 'DELETE' })
    expect(response.status).toBe(404)
    expect((await repository.list()).length).toBe(Object.keys(seedData).length)
  })
})

describe('GET /api/cvs/:id/pdf', () => {
  it('returns the rendered PDF as a download', async () => {
    const response = await app.request('/api/cvs/camille-martin/pdf')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="cv-camille-martin.pdf"',
    )
    expect(await response.text()).toBe('%PDF-fake')
  })

  it('answers 404 for an unknown CV without rendering', async () => {
    const response = await app.request('/api/cvs/inconnu/pdf')
    expect(response.status).toBe(404)
    expect(renderedIds).toEqual([])
  })
})

describe('POST /api/cvs/import', () => {
  const importPdf = (body: string | Uint8Array<ArrayBuffer>, query = '') =>
    app.request(`/api/cvs/import${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body,
    })

  it('creates the CV under a free id and returns the warnings', async () => {
    const response = await importPdf('%PDF-1.7 fake')
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      id: 'camille-martin-2',
      warnings: ['Bloc des compétences introuvable.'],
    })
    expect(await stored('camille-martin-2')).toEqual(seedData['camille-martin'])
    expect(await stored('camille-martin')).toEqual(seedData['camille-martin'])
  })

  it('names a CV imported as mine after my account when the PDF names someone else', async () => {
    parsed = {
      cv: { ...seedData['camille-martin']!, firstname: 'JLE', name: 'À compléter' },
      warnings: [
        "Le nom « JLE » n'a pas pu être séparé du prénom.",
        'Section « Langues » introuvable.',
      ],
    }
    identity = async () => ({ email: 'jeanne.leroy@zenika.com', name: 'Jeanne LEROY' })
    const response = await importPdf('%PDF-1.7 fake', '?owner=me')
    expect(await response.json()).toEqual({
      id: 'jeanne-leroy',
      warnings: [
        'Nom repris de votre compte : « Jeanne LEROY » (le PDF indiquait « JLE À compléter »).',
        'Section « Langues » introuvable.',
      ],
    })
    expect(await stored('jeanne-leroy')).toMatchObject({ firstname: 'Jeanne', name: 'Leroy' })
    expect((await repository.get('jeanne-leroy'))!.ownerEmail).toBe('jeanne.leroy@zenika.com')
  })

  it('refuses a second CV of my own', async () => {
    identity = async () => ({ email: 'Jeanne.Leroy@zenika.com', name: 'Jeanne LEROY' })
    expect((await importPdf('%PDF-1.7 fake', '?owner=me')).status).toBe(201)
    const response = await importPdf('%PDF-1.7 fake', '?owner=me')
    expect(response.status).toBe(409)
    expect(await response.text()).toBe(
      'vous avez déjà un CV : supprimez-le avant d’en importer un autre.',
    )
    expect((await repository.list()).length).toBe(Object.keys(seedData).length + 1)
  })

  it('keeps the name of a CV imported as mine when it matches my account', async () => {
    identity = async () => ({ email: 'camille.martin@zenika.com', name: 'CAMILLE MARTIN' })
    const response = await importPdf('%PDF-1.7 fake', '?owner=me')
    expect((await response.json()).warnings).toEqual(['Bloc des compétences introuvable.'])
    expect(await stored('camille-martin-2')).toMatchObject({ firstname: 'Camille', name: 'Martin' })
  })

  it('ignores my account for a CV imported for someone else', async () => {
    identity = async () => ({ email: 'jeanne.leroy@zenika.com', name: 'Jeanne LEROY' })
    expect((await (await importPdf('%PDF-1.7 fake')).json()).id).toBe('camille-martin-2')
    expect((await repository.get('camille-martin-2'))!.ownerEmail).toBeNull()
  })

  it('leaves an unknown name out of the id', async () => {
    parsed = {
      cv: { ...seedData['camille-martin']!, firstname: 'Élise', name: 'À compléter' },
      warnings: [],
    }
    expect(await (await importPdf('%PDF-1.7 fake')).json()).toEqual({ id: 'elise', warnings: [] })
  })

  it('rejects a file that is not a PDF', async () => {
    const response = await importPdf('bonjour')
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('le fichier envoyé n’est pas un PDF.')
  })

  it('rejects a PDF over 10 MB', async () => {
    const response = await importPdf(new Uint8Array(10 * 1024 * 1024 + 1))
    expect(response.status).toBe(413)
  })

  it('answers 422 when the PDF cannot be imported', async () => {
    parsed = new CvImportError('le PDF ne contient aucun texte.')
    const response = await importPdf('%PDF-1.7 fake')
    expect(response.status).toBe(422)
    expect(await response.text()).toBe('le PDF ne contient aucun texte.')
    expect((await repository.list()).length).toBe(Object.keys(seedData).length)
  })
})

describe('unknown routes', () => {
  it('answers 404 under /api', async () => {
    expect((await app.request('/api/inconnu')).status).toBe(404)
  })
})
