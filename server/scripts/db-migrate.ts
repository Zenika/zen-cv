import { createPool, migrate } from '../db/database.ts'

const pool = createPool(process.env.DATABASE_URL)
try {
  await migrate(pool)
  console.log('table cvs prête.')
} finally {
  await pool.end()
}
