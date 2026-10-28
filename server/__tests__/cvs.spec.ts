import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UserData } from '../../shared/cv.ts'
import { createApp } from '../app.ts'
import { readSeed, seedFile } from '../db/seed.ts'
import type { CvRepository } from '../repository/cvRepository.ts'
import { createCvService } from '../services/cvService.ts'
import { createMemoryRepository } from './memoryRepository.ts'

let seedData: Record<string, UserData>
let repository: CvRepository
let app: ReturnType<typeof createApp>
let renderedIds: string[]

function put(id: string, body: unknown) {
  return app.request(`/api/cvs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

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
  app = createApp(createCvService(repository, pdfRenderer))
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
  it('returns the CV', async () => {
    const response = await app.request('/api/cvs/camille-martin')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(seedData['camille-martin'])
  })

  it('answers 404 for an unknown CV', async () => {
    const response = await app.request('/api/cvs/inconnu')
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('aucun CV ne correspond à « inconnu ».')
  })
})

describe('PUT /api/cvs/:id', () => {
  it('replaces the CV', async () => {
    const cv = { ...seedData['camille-martin']!, title: 'Architecte Cloud' }
    expect((await put('camille-martin', cv)).status).toBe(204)
    expect(await repository.get('camille-martin')).toEqual(cv)
  })

  it('drops unknown fields', async () => {
    const cv = seedData['camille-martin']!
    await put('camille-martin', { ...cv, unexpected: true })
    expect(await repository.get('camille-martin')).toEqual(cv)
  })

  it('rejects an invalid CV with the faulty field and keeps the data', async () => {
    const response = await put('camille-martin', { ...seedData['camille-martin']!, title: 42 })
    expect(response.status).toBe(400)
    expect(await response.text()).toContain('→ at title')
    expect(await repository.get('camille-martin')).toEqual(seedData['camille-martin'])
  })

  it('rejects malformed JSON', async () => {
    expect((await put('camille-martin', '{oops')).status).toBe(400)
  })

  it('answers 404 for an unknown CV without creating it', async () => {
    expect((await put('inconnu', seedData['camille-martin'])).status).toBe(404)
    expect(await repository.get('inconnu')).toBeUndefined()
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
