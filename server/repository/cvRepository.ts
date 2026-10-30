import type { UserData } from '../../shared/cv.ts'

export type CvLink = { ownerEmail: string | null; sourceId: string | null; label: string | null }
export type StoredCv = CvLink & { id: string; cv: UserData }
export type VersionedCv = CvLink & { cv: UserData; version: number }
export type CvVersion = { id: string; label: string }
export type CvSource = { id: string; label: string }
export type UpdateResult = { version: number } | 'conflict' | 'not-found'
export type CreateResult = 'created' | 'id-taken' | 'owner-taken'
export type SetOwnerResult = 'set' | 'not-found' | 'already-owned' | 'owner-taken'

export type CvRepository = {
  list(): Promise<StoredCv[]>
  versions(sourceId: string): Promise<CvVersion[]>
  get(id: string): Promise<VersionedCv | undefined>
  update(id: string, cv: UserData, version: number): Promise<UpdateResult>
  create(id: string, cv: UserData, ownerEmail?: string, source?: CvSource): Promise<CreateResult>
  setLabel(id: string, label: string): Promise<boolean>
  setOwner(id: string, ownerEmail: string): Promise<SetOwnerResult>
  delete(id: string): Promise<boolean>
}
