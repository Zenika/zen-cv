import type { UserData } from '../../shared/cv.ts'
import type { CvRepository, VersionedCv } from '../repository/cvRepository.ts'

export function createMemoryRepository(initial: Record<string, UserData>): CvRepository {
  const cvs = new Map<string, VersionedCv>(
    Object.entries(structuredClone(initial)).map(([id, cv]) => [
      id,
      { cv, version: 1, ownerEmail: null, sourceId: null, label: null },
    ]),
  )
  const ownerTaken = (ownerEmail: string) =>
    [...cvs.values()].some((stored) => stored.ownerEmail === ownerEmail)

  return {
    async list() {
      return [...cvs].map(([id, { cv, ownerEmail, sourceId, label }]) => ({
        id,
        cv: structuredClone(cv),
        ownerEmail,
        sourceId,
        label,
      }))
    },
    async versions(sourceId) {
      return [...cvs]
        .filter(([, stored]) => stored.sourceId === sourceId)
        .map(([id, stored]) => ({ id, label: stored.label! }))
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
    async create(id, cv, ownerEmail, source) {
      if (cvs.has(id)) return 'id-taken'
      if (ownerEmail && ownerTaken(ownerEmail)) return 'owner-taken'
      cvs.set(id, {
        cv: structuredClone(cv),
        version: 1,
        ownerEmail: ownerEmail ?? null,
        sourceId: source?.id ?? null,
        label: source?.label ?? null,
      })
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
    async setLabel(id, label) {
      const stored = cvs.get(id)
      if (!stored?.sourceId) return false
      stored.label = label
      return true
    },
    async delete(id) {
      for (const [versionId, stored] of cvs) if (stored.sourceId === id) cvs.delete(versionId)
      return cvs.delete(id)
    },
  }
}
