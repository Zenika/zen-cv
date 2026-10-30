import type { UserData } from '../../shared/cv.ts'

export type StoredCv = { id: string; cv: UserData; ownerEmail: string | null }
export type VersionedCv = { cv: UserData; version: number; ownerEmail: string | null }
export type UpdateResult = { version: number } | 'conflict' | 'not-found'
export type CreateResult = 'created' | 'id-taken' | 'owner-taken'
export type SetOwnerResult = 'set' | 'not-found' | 'already-owned' | 'owner-taken'

export type CvRepository = {
  list(): Promise<StoredCv[]>
  get(id: string): Promise<VersionedCv | undefined>
  update(id: string, cv: UserData, version: number): Promise<UpdateResult>
  create(id: string, cv: UserData, ownerEmail?: string): Promise<CreateResult>
  setOwner(id: string, ownerEmail: string): Promise<SetOwnerResult>
  delete(id: string): Promise<boolean>
}
