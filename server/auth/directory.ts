import type { Relation } from '../../shared/cv.ts'
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

export type Profiles = (email: string) => Promise<DirectoryProfile | null>

export function cacheProfiles(lookup: DirectoryLookup, now: () => number = Date.now): Profiles {
  const cache = new Map<string, { profile: Promise<DirectoryProfile | null>; expires: number }>()

  async function resolve(email: string) {
    try {
      const profile = await lookup(email)
      if (profile.name) return profile
    } catch (error) {
      console.warn(
        `profil de ${email} introuvable dans l’annuaire : ${error instanceof Error ? error.message : error}`,
      )
    }
    cache.set(email, { profile: Promise.resolve(null), expires: now() + missingTtl })
    return null
  }

  return (email) => {
    const key = email.toLowerCase()
    let cached = cache.get(key)
    if (!cached || cached.expires <= now()) {
      cached = { profile: resolve(key), expires: now() + foundTtl }
      cache.set(key, cached)
    }
    return cached.profile
  }
}

export function withDirectoryProfiles(identity: Identity, profiles: Profiles): Identity {
  return async (headers) => {
    const user = await identity(headers)
    if (!user) return null
    const profile = await profiles(user.email)
    return profile ? { ...user, ...profile, name: profile.name ?? user.name } : user
  }
}
