import type { CurrentUser, Relation } from '../../shared/cv.ts'

export type RelationsOf = (email: string) => Promise<Relation[]>

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export const editorTitles = ['Business Developer', 'Directeur d’agence']
const normalizedEditorTitles = new Set(editorTitles.map(normalize))

export const editsEveryCv = (user: CurrentUser) =>
  !!user.title && normalizedEditorTitles.has(normalize(user.title))

export async function canEdit(
  user: CurrentUser,
  ownerEmail: string | null,
  relationsOf: RelationsOf,
) {
  if (editsEveryCv(user)) return true
  if (!ownerEmail) return false
  const email = user.email.toLowerCase()
  if (ownerEmail.toLowerCase() === email) return true
  return (await relationsOf(ownerEmail)).some(
    (relation) => relation.type === 'manager' && relation.value.toLowerCase() === email,
  )
}
