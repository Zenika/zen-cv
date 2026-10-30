import { describe, expect, it, vi } from 'vitest'
import {
  cacheProfiles,
  createDirectoryLookup,
  withDirectoryProfiles,
  type DirectoryLookup,
} from '../auth/directory.ts'
import type { Identity } from '../auth/identity.ts'

const directoryUser = {
  name: { fullName: 'Raphaël Grand' },
  organizations: [
    { title: 'Ancien poste', primary: false },
    { title: 'Consultant', department: 'Tech', primary: true },
  ],
  relations: [{ value: 'manager@zenika.com', type: 'manager' }, { type: 'assistant' }],
}

function fakeGoogle(directory: Response = Response.json(directoryUser)) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url.startsWith('http://metadata.google.internal/'))
      return Response.json({ access_token: 'directory-token' })
    if (url.startsWith('https://admin.googleapis.com/')) return directory.clone()
    return new Response('inattendu', { status: 500 })
  })
}

describe('createDirectoryLookup', () => {
  it('reads the profile with a directory-scoped token of the service account', async () => {
    const fetcher = fakeGoogle()
    expect(await createDirectoryLookup(fetcher)('raphael.grand@zenika.com')).toEqual({
      name: 'Raphaël Grand',
      title: 'Consultant',
      relations: [{ value: 'manager@zenika.com', type: 'manager' }],
    })
    expect(fetcher.mock.calls).toEqual([
      [
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadmin.directory.user.readonly',
        { headers: { 'Metadata-Flavor': 'Google' } },
      ],
      [
        'https://admin.googleapis.com/admin/directory/v1/users/raphael.grand%40zenika.com?fields=name,organizations,relations',
        { headers: { Authorization: 'Bearer directory-token' } },
      ],
    ])
  })

  it('takes the first title when no organization is primary, and accepts missing fields', async () => {
    const lookup = createDirectoryLookup(
      fakeGoogle(
        Response.json({ organizations: [{ department: 'Tech' }, { title: 'Consultant' }] }),
      ),
    )
    expect(await lookup('a@zenika.com')).toEqual({
      name: undefined,
      title: 'Consultant',
      relations: [],
    })
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

describe('withDirectoryProfiles', () => {
  const identity: Identity = async (headers) =>
    headers.has('x-user')
      ? { email: 'raphael.grand@zenika.com', name: 'Raphael Grand', relations: [] }
      : null
  const profile = {
    name: 'Raphaël Grand',
    title: 'Consultant',
    relations: [{ value: 'manager@zenika.com', type: 'manager' }],
  }
  const signedIn = new Headers({ 'x-user': '1' })

  it('adds the directory profile and caches it', async () => {
    const lookup = vi.fn<DirectoryLookup>().mockResolvedValue(profile)
    const profiles = cacheProfiles(lookup)
    const named = withDirectoryProfiles(identity, profiles)
    await Promise.all([named(signedIn), named(signedIn)])
    expect(await named(signedIn)).toEqual({ email: 'raphael.grand@zenika.com', ...profile })
    expect(await profiles('Raphael.Grand@zenika.com')).toEqual(profile)
    expect(lookup).toHaveBeenCalledOnce()
    expect(await named(new Headers())).toBeNull()
  })

  it('keeps the user from the email when the directory has no name', async () => {
    const lookup = vi
      .fn<DirectoryLookup>()
      .mockResolvedValue({ title: 'Consultant', relations: [] })
    expect(await withDirectoryProfiles(identity, cacheProfiles(lookup))(signedIn)).toEqual({
      email: 'raphael.grand@zenika.com',
      name: 'Raphael Grand',
      relations: [],
    })
  })

  it('keeps the user from the email when the directory fails, and retries later', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let time = 0
    const lookup = vi
      .fn<DirectoryLookup>()
      .mockRejectedValueOnce(new Error('annuaire Google Workspace : 403'))
      .mockResolvedValue(profile)
    const named = withDirectoryProfiles(
      identity,
      cacheProfiles(lookup, () => time),
    )

    expect((await named(signedIn))!.name).toBe('Raphael Grand')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('annuaire Google Workspace : 403'))
    expect((await named(signedIn))!.name).toBe('Raphael Grand')
    expect(lookup).toHaveBeenCalledOnce()

    time = 5 * 60 * 1000 + 1
    expect((await named(signedIn))!.name).toBe('Raphaël Grand')
    warn.mockRestore()
  })
})
