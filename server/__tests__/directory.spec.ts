import { describe, expect, it, vi } from 'vitest'
import {
  createDirectoryLookup,
  createUserDetails,
  withDirectoryNames,
  type NameLookup,
} from '../auth/directory.ts'
import type { Identity } from '../auth/identity.ts'

function fakeGoogle(directory: Response = Response.json({ name: { fullName: 'Raphaël Grand' } })) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url.startsWith('http://metadata.google.internal/'))
      return Response.json({ access_token: 'directory-token' })
    if (url.startsWith('https://admin.googleapis.com/')) return directory.clone()
    return new Response('inattendu', { status: 500 })
  })
}

describe('createDirectoryLookup', () => {
  it('reads the full name with a directory-scoped token of the service account', async () => {
    const fetcher = fakeGoogle()
    expect(await createDirectoryLookup(fetcher)('raphael.grand@zenika.com')).toBe('Raphaël Grand')
    expect(fetcher.mock.calls).toEqual([
      [
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadmin.directory.user.readonly',
        { headers: { 'Metadata-Flavor': 'Google' } },
      ],
      [
        'https://admin.googleapis.com/admin/directory/v1/users/raphael.grand%40zenika.com?fields=name',
        { headers: { Authorization: 'Bearer directory-token' } },
      ],
    ])
  })

  it('reports the failing step', async () => {
    const fetcher = fakeGoogle(
      new Response(
        '{\n  "error": {\n    "message": "Not Authorized to access this resource"\n  }\n}',
        {
          status: 403,
        },
      ),
    )
    await expect(createDirectoryLookup(fetcher)('a@zenika.com')).rejects.toThrow(
      'annuaire Google Workspace : 403 { "error": { "message": "Not Authorized to access this resource" } }',
    )
  })
})

describe('createUserDetails', () => {
  it('returns the full directory record and the groups, or the error of each', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.startsWith('http://metadata.google.internal/'))
        return Response.json({ access_token: 'token' })
      if (url.includes('/users/')) return Response.json({ primaryEmail: 'a@zenika.com' })
      return new Response('Not Authorized', { status: 403 })
    })
    expect(await createUserDetails(fetcher)('a@zenika.com')).toEqual({
      annuaire: { primaryEmail: 'a@zenika.com' },
      groupes: { erreur: 'groupes Google Workspace : 403 Not Authorized' },
    })
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('admin.directory.user.readonly'),
      'https://admin.googleapis.com/admin/directory/v1/users/a%40zenika.com?projection=full',
      expect.stringContaining('admin.directory.group.readonly'),
      'https://admin.googleapis.com/admin/directory/v1/groups?userKey=a%40zenika.com',
    ])
  })
})

describe('withDirectoryNames', () => {
  const identity: Identity = async (headers) =>
    headers.has('x-user') ? { email: 'raphael.grand@zenika.com', name: 'Raphael Grand' } : null
  const signedIn = new Headers({ 'x-user': '1' })

  it('replaces the name with the directory one and caches it', async () => {
    const lookup = vi.fn<NameLookup>().mockResolvedValue('Raphaël Grand')
    const named = withDirectoryNames(identity, lookup)
    await Promise.all([named(signedIn), named(signedIn)])
    expect(await named(signedIn)).toEqual({
      email: 'raphael.grand@zenika.com',
      name: 'Raphaël Grand',
    })
    expect(lookup).toHaveBeenCalledOnce()
    expect(await named(new Headers())).toBeNull()
  })

  it('keeps the name from the email when the directory fails, and retries later', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let time = 0
    const lookup = vi
      .fn<NameLookup>()
      .mockRejectedValueOnce(new Error('annuaire Google Workspace : 403'))
      .mockResolvedValue('Raphaël Grand')
    const named = withDirectoryNames(identity, lookup, () => time)

    expect((await named(signedIn))!.name).toBe('Raphael Grand')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('annuaire Google Workspace : 403'))
    expect((await named(signedIn))!.name).toBe('Raphael Grand')
    expect(lookup).toHaveBeenCalledOnce()

    time = 5 * 60 * 1000 + 1
    expect((await named(signedIn))!.name).toBe('Raphaël Grand')
    warn.mockRestore()
  })
})
