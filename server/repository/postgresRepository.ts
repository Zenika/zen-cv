import pg from 'pg'
import { cvSchema } from '../../shared/cv.ts'
import type { CvRepository } from './cvRepository.ts'

const isOwnerTaken = (error: unknown) =>
  error instanceof pg.DatabaseError &&
  error.code === '23505' &&
  error.constraint === 'cvs_owner_email'

export function createPostgresRepository(pool: pg.Pool): CvRepository {
  return {
    async list() {
      const { rows } = await pool.query<{ id: string; data: unknown; owner_email: string | null }>(
        'select id, data, owner_email from cvs order by created_at, id',
      )
      return rows.map(({ id, data, owner_email }) => ({
        id,
        cv: cvSchema.parse(data),
        ownerEmail: owner_email,
      }))
    },

    async get(id) {
      const { rows } = await pool.query<{
        data: unknown
        version: number
        owner_email: string | null
      }>('select data, version, owner_email from cvs where id = $1', [id])
      return (
        rows[0] && {
          cv: cvSchema.parse(rows[0].data),
          version: rows[0].version,
          ownerEmail: rows[0].owner_email,
        }
      )
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

    async create(id, cv, ownerEmail) {
      try {
        const { rowCount } = await pool.query(
          'insert into cvs (id, data, owner_email) values ($1, $2, $3) on conflict (id) do nothing',
          [id, JSON.stringify(cv), ownerEmail ?? null],
        )
        return rowCount === 1 ? 'created' : 'id-taken'
      } catch (error) {
        if (isOwnerTaken(error)) return 'owner-taken'
        throw error
      }
    },

    async setOwner(id, ownerEmail) {
      try {
        const { rowCount } = await pool.query(
          'update cvs set owner_email = $2 where id = $1 and owner_email is null',
          [id, ownerEmail],
        )
        if (rowCount === 1) return 'set'
      } catch (error) {
        if (isOwnerTaken(error)) return 'owner-taken'
        throw error
      }
      const { rowCount } = await pool.query('select 1 from cvs where id = $1', [id])
      return rowCount ? 'already-owned' : 'not-found'
    },

    async delete(id) {
      const { rowCount } = await pool.query('delete from cvs where id = $1', [id])
      return rowCount === 1
    },
  }
}
