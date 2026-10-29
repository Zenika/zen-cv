import { createPool, migrate } from '../server/db/database.ts'
import { seed } from '../server/db/seed.ts'
import { e2eSchema } from './database.ts'

const pool = createPool(process.env.DATABASE_URL)
try {
  await pool.query(`drop schema if exists ${e2eSchema} cascade`)
  await pool.query(`create schema ${e2eSchema}`)
  await migrate(pool)
  await seed(pool)
} finally {
  await pool.end()
}
