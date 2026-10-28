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
      const { rows } = await pool.query<{ data: unknown }>('select data from cvs where id = $1', [
        id,
      ])
      return rows[0] && cvSchema.parse(rows[0].data)
    },

    async update(id, cv) {
      const { rowCount } = await pool.query(
        'update cvs set data = $2, updated_at = clock_timestamp() where id = $1',
        [id, JSON.stringify(cv)],
      )
      return rowCount === 1
    },
  }
}
