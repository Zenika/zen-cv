import pg from 'pg'

export function createPool(connectionString: string | undefined, options: pg.PoolConfig = {}) {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL est absent : définissez-le dans .env.local ou dans l’environnement.',
    )
  }
  return new pg.Pool({ connectionString, ...options })
}

export async function migrate(pool: pg.Pool) {
  await pool.query(`
    create table if not exists cvs (
      id text primary key,
      data jsonb not null,
      created_at timestamptz not null default clock_timestamp(),
      updated_at timestamptz not null default clock_timestamp()
    )
  `)
  await pool.query('alter table cvs add column if not exists version integer not null default 1')
  await pool.query('alter table cvs add column if not exists owner_email text')
  await pool.query(
    'create unique index if not exists cvs_owner_email on cvs (owner_email) where owner_email is not null',
  )
}
