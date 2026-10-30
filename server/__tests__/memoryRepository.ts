import type { UserData } from '../../shared/cv.ts'
import type { CvRepository } from '../repository/cvRepository.ts'

export function createMemoryRepository(initial: Record<string, UserData>): CvRepository {
  const cvs = new Map(
    Object.entries(structuredClone(initial)).map(([id, cv]) => [id, { cv, version: 1 }]),
  )
  return {
    async list() {
      return [...cvs].map(([id, { cv }]) => ({ id, cv: structuredClone(cv) }))
    },
    async get(id) {
      return structuredClone(cvs.get(id))
    },
    async update(id, cv, version) {
      const stored = cvs.get(id)
      if (!stored) return 'not-found'
      if (stored.version !== version) return 'conflict'
      cvs.set(id, { cv: structuredClone(cv), version: version + 1 })
      return { version: version + 1 }
    },
    async delete(id) {
      return cvs.delete(id)
    },
    async create(id, cv) {
      if (cvs.has(id)) return false
      cvs.set(id, { cv: structuredClone(cv), version: 1 })
      return true
    },
  }
}
