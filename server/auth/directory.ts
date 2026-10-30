import type { CurrentUser, Relation } from '../../shared/cv.ts'
import type { Identity } from './identity.ts'

export type DirectoryProfile = { name?: string; title?: string; relations: Relation[] }
export type DirectoryLookup = (email: string) => Promise<DirectoryProfile>

const directoryScope = 'https://www.googleapis.com/auth/admin.directory.user.readonly'
const metadataTokenUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=${encodeURIComponent(directoryScope)}`

type DirectoryUser = {
  name?: { fullName?: string }
  organizations?: { title?: string; primary?: boolean }[]
  relations?: { value?: string; type?: string }[]
}

async function readJson<T>(response: Response, step: string): Promise<T> {
  if (!response.ok)
    throw new Error(`${step} : ${response.status} ${(await response.text()).replace(/\s+/g, ' ')}`)
  return response.json() as Promise<T>
}

function primaryTitle(organizations: DirectoryUser['organizations'] = []) {
  const withTitle = organizations.filter((organization) => organization.title)
  return (withTitle.find((organization) => organization.primary) ?? withTitle[0])?.title
}

function relations(user: DirectoryUser): Relation[] {
  return (user.relations ?? []).flatMap(({ value, type }) =>
    value ? [{ value, type: type ?? '' }] : [],
  )
}

export function createDirectoryLookup(fetcher: typeof fetch = fetch): DirectoryLookup {
  return async (email) => {
    const { access_token } = await readJson<{ access_token: string }>(
      await fetcher(metadataTokenUrl, { headers: { 'Metadata-Flavor': 'Google' } }),
      'jeton du compte de service',
    )
    const user = await readJson<DirectoryUser>(
      await fetcher(
        `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?fields=name,organizations,relations`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      ),
      'annuaire Google Workspace',
    )
    return {
      name: user.name?.fullName || undefined,
      title: primaryTitle(user.organizations),
      relations: relations(user),
    }
  }
}

const foundTtl = 12 * 60 * 60 * 1000
const missingTtl = 5 * 60 * 1000

export function withDirectoryProfiles(
  identity: Identity,
  lookup: DirectoryLookup,
  now: () => number = Date.now,
): Identity {
  const cache = new Map<string, { user: Promise<CurrentUser>; expires: number }>()

  async function resolve(fallback: CurrentUser) {
    try {
      const profile = await lookup(fallback.email)
      if (profile.name) return { ...fallback, ...profile, name: profile.name }
    } catch (error) {
      console.warn(
        `profil de ${fallback.email} introuvable dans l’annuaire : ${error instanceof Error ? error.message : error}`,
      )
    }
    cache.set(fallback.email, { user: Promise.resolve(fallback), expires: now() + missingTtl })
    return fallback
  }

  return async (headers) => {
    const user = await identity(headers)
    if (!user) return null
    let cached = cache.get(user.email)
    if (!cached || cached.expires <= now()) {
      cached = { user: resolve(user), expires: now() + foundTtl }
      cache.set(user.email, cached)
    }
    return cached.user
  }
}
