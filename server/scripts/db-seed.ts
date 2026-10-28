import { createPool, migrate } from '../db/database.ts'
import { seed } from '../db/seed.ts'

const pool = createPool(process.env.DATABASE_URL)
try {
  await migrate(pool)
  const inserted = await seed(pool)
  console.log(
    inserted.length ? `CV importés : ${inserted.join(', ')}.` : 'aucun nouveau CV à importer.',
  )
} finally {
  await pool.end()
}
