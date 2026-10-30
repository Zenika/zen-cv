import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UserData } from '../../shared/cv.ts'
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
  app = createApp(createCvService(repository, pdfRenderer, pdfImporter), (headers) =>
    identity(headers),
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

describe('PUT /api/cvs/:id', () => {
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

describe('DELETE /api/cvs/:id', () => {
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
  const importPdf = (body: string | Uint8Array<ArrayBuffer>) =>
    app.request('/api/cvs/import', {
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
