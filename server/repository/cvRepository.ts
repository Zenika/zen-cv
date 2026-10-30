import type { UserData } from '../../shared/cv.ts'

export type StoredCv = { id: string; cv: UserData }
export type VersionedCv = { cv: UserData; version: number }
export type UpdateResult = { version: number } | 'conflict' | 'not-found'

export type CvRepository = {
  list(): Promise<StoredCv[]>
  get(id: string): Promise<VersionedCv | undefined>
  update(id: string, cv: UserData, version: number): Promise<UpdateResult>
  create(id: string, cv: UserData): Promise<boolean>
  delete(id: string): Promise<boolean>
}
