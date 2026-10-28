import type { UserData } from '../../shared/cv.ts'

export type StoredCv = { id: string; cv: UserData }

export type CvRepository = {
  list(): Promise<StoredCv[]>
  get(id: string): Promise<UserData | undefined>
  save(id: string, cv: UserData): Promise<void>
}
