import { readFile, rename, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { cvSchema, type UserData } from '../../shared/cv.ts'
import type { CvRepository } from './cvRepository.ts'

const databaseSchema = z.record(z.string(), cvSchema)

export function createJsonRepository(file: string): CvRepository {
  let writes = Promise.resolve()

  async function read() {
    return databaseSchema.parse(JSON.parse(await readFile(file, 'utf-8')))
  }

  async function write(database: Record<string, UserData>) {
    const temporaryFile = `${file}.${process.pid}.tmp`
    await writeFile(temporaryFile, JSON.stringify(database, null, 2) + '\n', 'utf-8')
    await rename(temporaryFile, file)
  }

  return {
    async list() {
      return Object.entries(await read()).map(([id, cv]) => ({ id, cv }))
    },

    async get(id) {
      return (await read())[id]
    },

    save(id, cv) {
      const saving = writes.then(async () => {
        const database = await read()
        database[id] = cv
        await write(database)
      })
      writes = saving.catch(() => {})
      return saving
    },
  }
}
