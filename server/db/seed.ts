import { readFile } from 'node:fs/promises'
import type pg from 'pg'
import { z } from 'zod'
import { cvSchema } from '../../shared/cv.ts'

export const seedFile = new URL('./seed.json', import.meta.url)

export async function readSeed() {
  return z.record(z.string(), cvSchema).parse(JSON.parse(await readFile(seedFile, 'utf-8')))
}

export async function seed(pool: pg.Pool) {
  const inserted: string[] = []
  for (const [id, cv] of Object.entries(await readSeed())) {
    const { rowCount } = await pool.query(
      'insert into cvs (id, data) values ($1, $2) on conflict (id) do nothing',
      [id, JSON.stringify(cv)],
    )
    if (rowCount) inserted.push(id)
  }
  return inserted
}
