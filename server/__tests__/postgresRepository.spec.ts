import type pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPool, migrate } from '../db/database.ts'
import { readSeed, seed } from '../db/seed.ts'
import { createPostgresRepository } from '../repository/postgresRepository.ts'

const databaseUrl = process.env.TEST_DATABASE_URL
const schema = `test_${process.pid}_${Date.now()}`

describe.skipIf(!databaseUrl)('postgres repository', () => {
  let admin: pg.Pool
  let pool: pg.Pool

  beforeAll(async () => {
    admin = createPool(databaseUrl)
    await admin.query(`create schema ${schema}`)
    pool = createPool(databaseUrl, { options: `-c search_path=${schema}` })
    await migrate(pool)
  })

  afterAll(async () => {
    await pool?.end()
    await admin?.query(`drop schema if exists ${schema} cascade`)
    await admin?.end()
  })

  beforeEach(async () => {
    await pool.query('truncate cvs')
  })

  it('seeds every CV once, in the seed order, without overwriting edits', async () => {
    const seedData = await readSeed()
    expect(await seed(pool)).toEqual(Object.keys(seedData))

    const repository = createPostgresRepository(pool)
    const edited = { ...seedData['camille-martin']!, title: 'Modifié' }
    await repository.update('camille-martin', edited, 1)
    expect(await seed(pool)).toEqual([])

    expect((await repository.list()).map(({ id }) => id)).toEqual(Object.keys(seedData))
    expect(await repository.get('camille-martin')).toEqual({
      cv: edited,
      version: 2,
      ownerEmail: null,
    })
    expect(await repository.get('raphael-grand')).toEqual({
      cv: seedData['raphael-grand'],
      version: 1,
      ownerEmail: null,
    })
  })

  it('updates an existing CV at the expected version only', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const { cv, version } = (await repository.get('camille-martin'))!
    expect(version).toBe(1)
    expect(await repository.update('inconnu', cv, 1)).toBe('not-found')
    expect(await repository.get('inconnu')).toBeUndefined()

    const { rows: before } = await pool.query(
      "select updated_at from cvs where id = 'camille-martin'",
    )
    expect(await repository.update('camille-martin', { ...cv, title: 'Nouveau' }, 1)).toEqual({
      version: 2,
    })
    const { rows: after } = await pool.query(
      "select updated_at from cvs where id = 'camille-martin'",
    )
    expect(await repository.get('camille-martin')).toEqual({
      cv: { ...cv, title: 'Nouveau' },
      version: 2,
      ownerEmail: null,
    })
    expect(after[0].updated_at.getTime()).toBeGreaterThan(before[0].updated_at.getTime())

    expect(await repository.update('camille-martin', { ...cv, title: 'Périmé' }, 1)).toBe(
      'conflict',
    )
    expect((await repository.get('camille-martin'))!.cv.title).toBe('Nouveau')
  })

  it('accepts only one of two saves made from the same version', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const { cv } = (await repository.get('camille-martin'))!
    const results = await Promise.all([
      repository.update('camille-martin', { ...cv, title: 'Premier' }, 1),
      repository.update('camille-martin', { ...cv, title: 'Second' }, 1),
    ])
    expect(results.filter((result) => result === 'conflict')).toHaveLength(1)
    expect((await repository.get('camille-martin'))!.version).toBe(2)
  })

  it('creates a CV only under a free id', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const seedData = await readSeed()
    const imported = { ...seedData['camille-martin']!, title: 'Importé' }
    expect(await repository.create('camille-martin', imported)).toBe('id-taken')
    expect((await repository.get('camille-martin'))!.cv).toEqual(seedData['camille-martin'])
    expect(await repository.create('camille-martin-2', imported)).toBe('created')
    expect(await repository.get('camille-martin-2')).toEqual({
      cv: imported,
      version: 1,
      ownerEmail: null,
    })
  })

  it('gives each person one CV at most', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const { cv } = (await repository.get('camille-martin'))!
    expect(await repository.create('mien', cv, 'jeanne.leroy@zenika.com')).toBe('created')
    expect(await repository.create('autre', cv, 'jeanne.leroy@zenika.com')).toBe('owner-taken')
    expect(await repository.get('autre')).toBeUndefined()

    expect(await repository.setOwner('camille-martin', 'jeanne.leroy@zenika.com')).toBe(
      'owner-taken',
    )
    expect(await repository.setOwner('camille-martin', 'camille.martin@zenika.com')).toBe('set')
    expect(await repository.setOwner('camille-martin', 'paul.durand@zenika.com')).toBe(
      'already-owned',
    )
    expect(await repository.setOwner('inconnu', 'paul.durand@zenika.com')).toBe('not-found')
    expect((await repository.list()).map(({ id, ownerEmail }) => ({ id, ownerEmail }))).toEqual([
      { id: 'raphael-grand', ownerEmail: null },
      { id: 'camille-martin', ownerEmail: 'camille.martin@zenika.com' },
      { id: 'mien', ownerEmail: 'jeanne.leroy@zenika.com' },
    ])

    await repository.delete('mien')
    expect(await repository.create('nouveau', cv, 'jeanne.leroy@zenika.com')).toBe('created')
  })

  it('deletes an existing CV only', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    expect(await repository.delete('inconnu')).toBe(false)
    expect(await repository.delete('camille-martin')).toBe(true)
    expect(await repository.get('camille-martin')).toBeUndefined()
    expect((await repository.list()).map(({ id }) => id)).toEqual(['raphael-grand'])
  })

  it('stores versions under their main CV and deletes them with it', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const cv = (await repository.get('camille-martin'))!.cv
    const source = { id: 'camille-martin', label: 'Banque' }
    expect(await repository.create('camille-martin-v2', cv, undefined, source)).toBe('created')
    expect(
      await repository.create('camille-martin-v3', cv, undefined, { ...source, label: 'Autre' }),
    ).toBe('created')
    expect(await repository.get('camille-martin-v2')).toMatchObject({
      sourceId: 'camille-martin',
      label: 'Banque',
      ownerEmail: null,
    })
    expect(await repository.setLabel('camille-martin-v3', 'Assurance')).toBe(true)
    expect(await repository.setLabel('camille-martin', 'Principal')).toBe(false)
    expect(await repository.versions('camille-martin')).toEqual([
      { id: 'camille-martin-v2', label: 'Banque' },
      { id: 'camille-martin-v3', label: 'Assurance' },
    ])
    expect(await repository.get('camille-martin')).toMatchObject({ sourceId: null, label: null })

    await repository.delete('camille-martin')
    expect(await repository.get('camille-martin-v2')).toBeUndefined()
    expect((await repository.list()).map(({ id }) => id)).toEqual(['raphael-grand'])
  })

  it('reads a CV stored before certifications existed', async () => {
    const { certifications: _certifications, ...legacy } = (await readSeed())['camille-martin']!
    await pool.query("insert into cvs (id, data) values ('ancien', $1)", [JSON.stringify(legacy)])
    expect((await createPostgresRepository(pool).get('ancien'))!.cv.certifications).toEqual([])
  })

  it('keeps every change when different CVs are updated concurrently', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const seedData = await readSeed()
    await Promise.all([
      repository.update('camille-martin', { ...seedData['camille-martin']!, title: 'Premier' }, 1),
      repository.update('raphael-grand', { ...seedData['raphael-grand']!, title: 'Second' }, 1),
    ])
    expect((await repository.get('camille-martin'))!.cv.title).toBe('Premier')
    expect((await repository.get('raphael-grand'))!.cv.title).toBe('Second')
  })
})
