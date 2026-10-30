import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { CurrentUser } from '../../shared/cv.ts'

export type Identity = (headers: Headers) => Promise<CurrentUser | null>

export const internalTokenHeader = 'x-zen-cv-internal-token'

const iapKeys = createRemoteJWKSet(new URL('https://www.gstatic.com/iap/verify/public_key-jwk'))

export function nameFromEmail(email: string) {
  const name = email
    .split('@')[0]!
    .replace(/\+.*$/, '')
    .split(/[._]+/)
    .filter(Boolean)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/(^|-)(\p{L})/gu, (_, start, letter) => start + letter.toUpperCase()),
    )
    .join(' ')
  return name || email
}

const userFromEmail = (email: string) => ({ email, name: nameFromEmail(email), relations: [] })

function receivedAudience(assertion: string) {
  try {
    return JSON.stringify(decodeJwt(assertion).aud)
  } catch {
    return 'illisible'
  }
}

export function createIapIdentity(audience: string, keys: JWTVerifyGetKey = iapKeys): Identity {
  return async (headers) => {
    const assertion = headers.get('x-goog-iap-jwt-assertion')
    if (!assertion) return null
    try {
      const { payload } = await jwtVerify(assertion, keys, {
        issuer: 'https://cloud.google.com/iap',
        audience,
        algorithms: ['ES256'],
      })
      return typeof payload.email === 'string' ? userFromEmail(payload.email) : null
    } catch (error) {
      console.warn(
        `jeton IAP refusé : ${error instanceof Error ? error.message : error} (aud reçu : ${receivedAudience(assertion)}, attendu : "${audience}")`,
      )
      return null
    }
  }
}

export function createFixedIdentity(email: string, title?: string): Identity {
  return async () => ({ ...userFromEmail(email), ...(title && { title }) })
}

export function withInternalToken(identity: Identity, token: string): Identity {
  return async (headers) =>
    headers.get(internalTokenHeader) === token
      ? userFromEmail('export-pdf@zen-cv')
      : identity(headers)
}
