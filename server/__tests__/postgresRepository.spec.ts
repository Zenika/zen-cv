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
    await repository.update('camille-martin', edited)
    expect(await seed(pool)).toEqual([])

    expect((await repository.list()).map(({ id }) => id)).toEqual(Object.keys(seedData))
    expect(await repository.get('camille-martin')).toEqual(edited)
    expect(await repository.get('raphael-grand')).toEqual(seedData['raphael-grand'])
  })

  it('updates an existing CV only', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const cv = (await repository.get('camille-martin'))!
    expect(await repository.update('inconnu', cv)).toBe(false)
    expect(await repository.get('inconnu')).toBeUndefined()

    const { rows: before } = await pool.query(
      "select updated_at from cvs where id = 'camille-martin'",
    )
    expect(await repository.update('camille-martin', { ...cv, title: 'Nouveau' })).toBe(true)
    const { rows: after } = await pool.query(
      "select updated_at from cvs where id = 'camille-martin'",
    )
    expect((await repository.get('camille-martin'))!.title).toBe('Nouveau')
    expect(after[0].updated_at.getTime()).toBeGreaterThan(before[0].updated_at.getTime())
  })

  it('keeps every change when updates run concurrently', async () => {
    await seed(pool)
    const repository = createPostgresRepository(pool)
    const seedData = await readSeed()
    await Promise.all([
      repository.update('camille-martin', { ...seedData['camille-martin']!, title: 'Premier' }),
      repository.update('raphael-grand', { ...seedData['raphael-grand']!, title: 'Second' }),
    ])
    expect((await repository.get('camille-martin'))!.title).toBe('Premier')
    expect((await repository.get('raphael-grand'))!.title).toBe('Second')
  })
})
