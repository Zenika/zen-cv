import { z } from 'zod'

export const realisationSchema = z.object({
  title: z.string().optional(),
  type: z.string(),
  description: z.union([z.string(), z.array(z.string())]),
})

export const experienceSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  period: z.string(),
  team: z.string().optional(),
  context: z.string(),
  realisations: z.array(realisationSchema),
  technicalEnvironment: z.array(z.object({ name: z.string(), value: z.string() })),
})

export const cvSchema = z.object({
  firstname: z.string().min(1),
  name: z.string().min(1),
  title: z.string(),
  bio: z.string(),
  expertise: z.array(z.object({ name: z.string(), level: z.string() })),
  methodologies: z.array(z.string()),
  trainer: z.array(z.string()),
  certifications: z.array(z.string()).default([]),
  experiences: z.array(experienceSchema),
  education: z.array(z.object({ period: z.string(), title: z.string(), school: z.string() })),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
})

export type Realisation = z.infer<typeof realisationSchema>
export type Experience = z.infer<typeof experienceSchema>
export type UserData = z.infer<typeof cvSchema>
export type Relation = { value: string; type: string }
export type CurrentUser = { email: string; name: string; title?: string; relations?: Relation[] }
export type CvSummary = Pick<UserData, 'firstname' | 'name' | 'title'> & {
  id: string
  ownerEmail: string | null
}
