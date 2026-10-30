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
