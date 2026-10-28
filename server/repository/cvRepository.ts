import type { UserData } from '../../shared/cv.ts'

export type StoredCv = { id: string; cv: UserData }

export type CvRepository = {
  list(): Promise<StoredCv[]>
  get(id: string): Promise<UserData | undefined>
  update(id: string, cv: UserData): Promise<boolean>
}
