import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createFixedIdentity,
  createIapIdentity,
  internalTokenHeader,
  nameFromEmail,
  withInternalToken,
  type Identity,
} from '../auth/identity.ts'

const audience = '/projects/123/locations/europe-west9/services/zen-cv'
let privateKey: CryptoKey
let identity: Identity

beforeAll(async () => {
  const keys = await generateKeyPair('ES256')
  privateKey = keys.privateKey
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test', alg: 'ES256' }
  identity = createIapIdentity(audience, createLocalJWKSet({ keys: [jwk] }))
})

function assertion(claims: { aud?: string; iss?: string; email?: string } = {}) {
  return new SignJWT({ email: claims.email ?? 'camille.martin@zenika.com' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test' })
    .setIssuer(claims.iss ?? 'https://cloud.google.com/iap')
    .setAudience(claims.aud ?? audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
}

const withAssertion = async (token: Promise<string>) =>
  new Headers({ 'x-goog-iap-jwt-assertion': await token })

describe('IAP identity', () => {
  it('reads the email from a valid IAP assertion', async () => {
    expect(await identity(await withAssertion(assertion()))).toEqual({
      email: 'camille.martin@zenika.com',
      name: 'Camille Martin',
    })
  })

  it('refuses a request without an assertion', async () => {
    expect(
      await identity(
        new Headers({ 'x-goog-authenticated-user-email': 'accounts.google.com:a@b.c' }),
      ),
    ).toBeNull()
  })

  it('refuses an assertion for another service or issuer, and logs the audience received', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      await identity(await withAssertion(assertion({ aud: '/projects/123/other' }))),
    ).toBeNull()
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringContaining('aud reçu : "/projects/123/other"'),
    )
    expect(
      await identity(await withAssertion(assertion({ iss: 'https://pirate.example' }))),
    ).toBeNull()
    expect(await identity(new Headers({ 'x-goog-iap-jwt-assertion': 'pas.un.jeton' }))).toBeNull()
    warn.mockRestore()
  })
})

describe('internal token', () => {
  const internal = withInternalToken(async () => null, 'secret')

  it('lets the PDF export in with the token only', async () => {
    expect(await internal(new Headers({ [internalTokenHeader]: 'secret' }))).toMatchObject({
      email: 'export-pdf@zen-cv',
    })
    expect(await internal(new Headers({ [internalTokenHeader]: 'autre' }))).toBeNull()
    expect(await internal(new Headers())).toBeNull()
  })
})

describe('fixed identity', () => {
  it('always returns the configured user', async () => {
    expect(await createFixedIdentity('dev@localhost')(new Headers())).toEqual({
      email: 'dev@localhost',
      name: 'Dev',
    })
  })
})

describe('nameFromEmail', () => {
  it('builds the name from a firstname.lastname address', () => {
    expect(nameFromEmail('jean-marc.dupont@zenika.com')).toBe('Jean-Marc Dupont')
    expect(nameFromEmail('ANNE_LE.GALL+cv@zenika.com')).toBe('Anne Le Gall')
  })

  it('falls back to the email when there is no name to read', () => {
    expect(nameFromEmail('+cv@zenika.com')).toBe('+cv@zenika.com')
  })
})
