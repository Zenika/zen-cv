import pg from 'pg'
import { cvSchema } from '../../shared/cv.ts'
import type { CvLink, CvRepository } from './cvRepository.ts'

type LinkRow = { owner_email: string | null; source_id: string | null; label: string | null }

const link = (row: LinkRow): CvLink => ({
  ownerEmail: row.owner_email,
  sourceId: row.source_id,
  label: row.label,
})

const isOwnerTaken = (error: unknown) =>
  error instanceof pg.DatabaseError &&
  error.code === '23505' &&
  error.constraint === 'cvs_owner_email'

export function createPostgresRepository(pool: pg.Pool): CvRepository {
  return {
    async list() {
      const { rows } = await pool.query<LinkRow & { id: string; data: unknown }>(
        'select id, data, owner_email, source_id, label from cvs order by created_at, id',
      )
      return rows.map((row) => ({ id: row.id, cv: cvSchema.parse(row.data), ...link(row) }))
    },

    async versions(sourceId) {
      const { rows } = await pool.query<{ id: string; label: string }>(
        'select id, label from cvs where source_id = $1 order by created_at, id',
        [sourceId],
      )
      return rows
    },

    async get(id) {
      const { rows } = await pool.query<LinkRow & { data: unknown; version: number }>(
        'select data, version, owner_email, source_id, label from cvs where id = $1',
        [id],
      )
      return (
        rows[0] && {
          cv: cvSchema.parse(rows[0].data),
          version: rows[0].version,
          ...link(rows[0]),
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

    async create(id, cv, ownerEmail, source) {
      try {
        const { rowCount } = await pool.query(
          `insert into cvs (id, data, owner_email, source_id, label) values ($1, $2, $3, $4, $5)
           on conflict (id) do nothing`,
          [id, JSON.stringify(cv), ownerEmail ?? null, source?.id ?? null, source?.label ?? null],
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

    async setLabel(id, label) {
      const { rowCount } = await pool.query(
        'update cvs set label = $2 where id = $1 and source_id is not null',
        [id, label],
      )
      return rowCount === 1
    },

    async delete(id) {
      const { rowCount } = await pool.query('delete from cvs where id = $1', [id])
      return rowCount === 1
    },
  }
}
