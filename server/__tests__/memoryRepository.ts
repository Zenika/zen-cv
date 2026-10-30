import type { UserData } from '../../shared/cv.ts'
import type { CvRepository } from '../repository/cvRepository.ts'

type Stored = { cv: UserData; version: number; ownerEmail: string | null }

export function createMemoryRepository(initial: Record<string, UserData>): CvRepository {
  const cvs = new Map<string, Stored>(
    Object.entries(structuredClone(initial)).map(([id, cv]) => [
      id,
      { cv, version: 1, ownerEmail: null },
    ]),
  )
  const ownerTaken = (ownerEmail: string) =>
    [...cvs.values()].some((stored) => stored.ownerEmail === ownerEmail)

  return {
    async list() {
      return [...cvs].map(([id, { cv, ownerEmail }]) => ({
        id,
        cv: structuredClone(cv),
        ownerEmail,
      }))
    },
    async get(id) {
      return structuredClone(cvs.get(id))
    },
    async update(id, cv, version) {
      const stored = cvs.get(id)
      if (!stored) return 'not-found'
      if (stored.version !== version) return 'conflict'
      cvs.set(id, { ...stored, cv: structuredClone(cv), version: version + 1 })
      return { version: version + 1 }
    },
    async create(id, cv, ownerEmail) {
      if (cvs.has(id)) return 'id-taken'
      if (ownerEmail && ownerTaken(ownerEmail)) return 'owner-taken'
      cvs.set(id, { cv: structuredClone(cv), version: 1, ownerEmail: ownerEmail ?? null })
      return 'created'
    },
    async setOwner(id, ownerEmail) {
      const stored = cvs.get(id)
      if (!stored) return 'not-found'
      if (stored.ownerEmail) return 'already-owned'
      if (ownerTaken(ownerEmail)) return 'owner-taken'
      stored.ownerEmail = ownerEmail
      return 'set'
    },
    async delete(id) {
      return cvs.delete(id)
    },
  }
}
