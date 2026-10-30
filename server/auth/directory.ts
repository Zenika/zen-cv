import type { Identity } from './identity.ts'

export type NameLookup = (email: string) => Promise<string | undefined>

const directoryScope = 'https://www.googleapis.com/auth/admin.directory.user.readonly'
const metadataTokenUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=${encodeURIComponent(directoryScope)}`

async function readJson<T>(response: Response, step: string): Promise<T> {
  if (!response.ok)
    throw new Error(`${step} : ${response.status} ${(await response.text()).replace(/\s+/g, ' ')}`)
  return response.json() as Promise<T>
}

export function createDirectoryLookup(fetcher: typeof fetch = fetch): NameLookup {
  return async (email) => {
    const { access_token } = await readJson<{ access_token: string }>(
      await fetcher(metadataTokenUrl, { headers: { 'Metadata-Flavor': 'Google' } }),
      'jeton du compte de service',
    )
    const user = await readJson<{ name?: { fullName?: string } }>(
      await fetcher(
        `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?fields=name`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      ),
      'annuaire Google Workspace',
    )
    return user.name?.fullName || undefined
  }
}

const groupScope = 'https://www.googleapis.com/auth/admin.directory.group.readonly'

export type UserDetails = (email: string) => Promise<Record<string, unknown>>

export function createUserDetails(fetcher: typeof fetch = fetch): UserDetails {
  async function attempt(run: () => Promise<unknown>) {
    try {
      return await run()
    } catch (error) {
      return { erreur: error instanceof Error ? error.message : String(error) }
    }
  }

  async function token(scopes: string[]) {
    const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=${encodeURIComponent(scopes.join(','))}`
    const { access_token } = await readJson<{ access_token: string }>(
      await fetcher(url, { headers: { 'Metadata-Flavor': 'Google' } }),
      'jeton du compte de service',
    )
    return access_token
  }

  async function get(url: string, scopes: string[], step: string) {
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${await token(scopes)}` },
    })
    return readJson<unknown>(response, step)
  }

  const api = 'https://admin.googleapis.com/admin/directory/v1'

  return async (email) => ({
    annuaire: await attempt(() =>
      get(
        `${api}/users/${encodeURIComponent(email)}?projection=full`,
        [directoryScope],
        'annuaire Google Workspace',
      ),
    ),
    groupes: await attempt(() =>
      get(
        `${api}/groups?userKey=${encodeURIComponent(email)}`,
        [groupScope],
        'groupes Google Workspace',
      ),
    ),
  })
}

const foundTtl = 12 * 60 * 60 * 1000
const missingTtl = 5 * 60 * 1000

export function withDirectoryNames(
  identity: Identity,
  lookup: NameLookup,
  now: () => number = Date.now,
): Identity {
  const cache = new Map<string, { name: Promise<string>; expires: number }>()

  async function resolve(email: string, fallback: string) {
    try {
      const name = await lookup(email)
      if (name) return name
    } catch (error) {
      console.warn(
        `nom de ${email} introuvable dans l’annuaire : ${error instanceof Error ? error.message : error}`,
      )
    }
    cache.set(email, { name: Promise.resolve(fallback), expires: now() + missingTtl })
    return fallback
  }

  return async (headers) => {
    const user = await identity(headers)
    if (!user) return null
    let cached = cache.get(user.email)
    if (!cached || cached.expires <= now()) {
      cached = { name: resolve(user.email, user.name), expires: now() + foundTtl }
      cache.set(user.email, cached)
    }
    return { ...user, name: await cached.name }
  }
}
