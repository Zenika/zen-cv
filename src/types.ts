import type userDataJson from './bdd/raphael.json'

export type Realisation = { title?: string; type: string; description: string | string[] }

export type Experience = {
  name: string
  position: string
  period: string
  team?: string
  context: string
  realisations: Realisation[]
  technicalEnvironment: { name: string; value: string }[]
}

// The JSON's inferred experience types are too narrow to accept new entries
export type UserData = Omit<typeof userDataJson, 'experiences'> & { experiences: Experience[] }
