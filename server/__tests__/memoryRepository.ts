import type { UserData } from '../../shared/cv.ts'
import type { CvRepository } from '../repository/cvRepository.ts'

export function createMemoryRepository(initial: Record<string, UserData>): CvRepository {
  const cvs = new Map(Object.entries(structuredClone(initial)))
  return {
    async list() {
      return [...cvs].map(([id, cv]) => ({ id, cv: structuredClone(cv) }))
    },
    async get(id) {
      return structuredClone(cvs.get(id))
    },
    async update(id, cv) {
      if (!cvs.has(id)) return false
      cvs.set(id, structuredClone(cv))
      return true
    },
    async delete(id) {
      return cvs.delete(id)
    },
    async create(id, cv) {
      if (cvs.has(id)) return false
      cvs.set(id, structuredClone(cv))
      return true
    },
  }
}
