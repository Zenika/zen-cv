import { copyFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cvSchema, type UserData } from '../../shared/cv.ts'
import { createApp } from '../app.ts'
import { createJsonRepository } from '../repository/jsonRepository.ts'
import { createCvService } from '../services/cvService.ts'

const sourceDatabase = new URL('../../src/bdd/cv-database.json', import.meta.url)

let directory: string
let databaseFile: string
let app: ReturnType<typeof createApp>
let renderedIds: string[]

async function readDatabase(): Promise<Record<string, UserData>> {
  return JSON.parse(await readFile(databaseFile, 'utf-8'))
}

function put(id: string, body: unknown) {
  return app.request(`/api/cvs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'zen-cv-'))
  databaseFile = join(directory, 'cv-database.json')
  await copyFile(sourceDatabase, databaseFile)
  renderedIds = []
  const pdfRenderer = {
    async render(id: string) {
      renderedIds.push(id)
      return new TextEncoder().encode('%PDF-fake')
    },
  }
  app = createApp(createCvService(createJsonRepository(databaseFile), pdfRenderer))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('database', () => {
  it('matches the CV schema without losing any field', async () => {
    for (const cv of Object.values(await readDatabase())) {
      expect(isDeepStrictEqual(cvSchema.parse(cv), cv)).toBe(true)
    }
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
  it('returns the CV', async () => {
    const response = await app.request('/api/cvs/camille-martin')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual((await readDatabase())['camille-martin'])
  })

  it('answers 404 for an unknown CV', async () => {
    const response = await app.request('/api/cvs/inconnu')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('aucun CV ne correspond à « inconnu ».')
  })
})

describe('PUT /api/cvs/:id', () => {
  it('replaces the CV', async () => {
    const cv = { ...(await readDatabase())['camille-martin']!, title: 'Architecte Cloud' }
    const response = await put('camille-martin', cv)
    expect(response.status).toBe(204)
    expect((await readDatabase())['camille-martin']).toEqual(cv)
    expect(await readdir(directory)).toEqual(['cv-database.json'])
  })

  it('drops unknown fields', async () => {
    const cv = (await readDatabase())['camille-martin']!
    await put('camille-martin', { ...cv, unexpected: true })
    expect((await readDatabase())['camille-martin']).toEqual(cv)
  })

  it('rejects an invalid CV with the faulty field and keeps the data', async () => {
    const before = await readFile(databaseFile, 'utf-8')
    const cv = (await readDatabase())['camille-martin']!
    const response = await put('camille-martin', { ...cv, title: 42 })
    expect(response.status).toBe(400)
    expect(await response.text()).toContain('→ at title')
    expect(await readFile(databaseFile, 'utf-8')).toBe(before)
  })

  it('rejects malformed JSON', async () => {
    expect((await put('camille-martin', '{oops')).status).toBe(400)
  })

  it('answers 404 for an unknown CV without creating it', async () => {
    const cv = (await readDatabase())['camille-martin']!
    expect((await put('inconnu', cv)).status).toBe(404)
    expect((await readDatabase())['inconnu']).toBeUndefined()
  })

  it('keeps every change when saves run concurrently', async () => {
    const database = await readDatabase()
    await Promise.all([
      put('camille-martin', { ...database['camille-martin']!, title: 'Premier' }),
      put('raphael-grand', { ...database['raphael-grand']!, title: 'Second' }),
    ])
    const saved = await readDatabase()
    expect(saved['camille-martin']!.title).toBe('Premier')
    expect(saved['raphael-grand']!.title).toBe('Second')
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

describe('unknown routes', () => {
  it('answers 404 under /api', async () => {
    expect((await app.request('/api/inconnu')).status).toBe(404)
  })
})
