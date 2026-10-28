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

export type UserData = {
  firstname: string
  name: string
  title: string
  bio: string
  links: Record<string, string>[]
  expertise: { name: string; level: string }[]
  methodologies: string[]
  trainer: string[]
  experiences: Experience[]
  education: { period: string; title: string; school: string }[]
  languages: { name: string; level: string }[]
}

export type CvSummary = Pick<UserData, 'firstname' | 'name' | 'title'> & { id: string }
