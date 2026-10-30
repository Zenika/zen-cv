import type pg from 'pg'
import { cvSchema } from '../../shared/cv.ts'
import type { CvRepository } from './cvRepository.ts'

export function createPostgresRepository(pool: pg.Pool): CvRepository {
  return {
    async list() {
      const { rows } = await pool.query<{ id: string; data: unknown }>(
        'select id, data from cvs order by created_at, id',
      )
      return rows.map(({ id, data }) => ({ id, cv: cvSchema.parse(data) }))
    },

    async get(id) {
      const { rows } = await pool.query<{ data: unknown; version: number }>(
        'select data, version from cvs where id = $1',
        [id],
      )
      return rows[0] && { cv: cvSchema.parse(rows[0].data), version: rows[0].version }
    },

    async update(id, cv, version) {
      const { rows } = await pool.query<{ version: number }>(
        `update cvs set data = $2, version = version + 1, updated_at = clock_timestamp()
         where id = $1 and version = $3
         returning version`,
        [id, JSON.stringify(cv), version],
      )
      if (rows[0]) return { version: rows[0].version }
      const { rowCount } = await pool.query('select 1 from cvs where id = $1', [id])
      return rowCount ? 'conflict' : 'not-found'
    },

    async create(id, cv) {
      const { rowCount } = await pool.query(
        'insert into cvs (id, data) values ($1, $2) on conflict (id) do nothing',
        [id, JSON.stringify(cv)],
      )
      return rowCount === 1
    },

    async delete(id) {
      const { rowCount } = await pool.query('delete from cvs where id = $1', [id])
      return rowCount === 1
    },
  }
}
