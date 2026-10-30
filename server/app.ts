import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { createPdfRenderer } from './pdf/pdfRenderer.ts'
import { createPool, migrate } from './db/database.ts'
import { createPostgresRepository } from './repository/postgresRepository.ts'
import { createCvRoutes } from './routes/cvs.ts'
import { createCvService, type CvService } from './services/cvService.ts'
import type { CurrentUser } from '../shared/cv.ts'
import {
  cacheProfiles,
  createDirectoryLookup,
  withDirectoryProfiles,
  type Profiles,
} from './auth/directory.ts'
import {
  createFixedIdentity,
  createIapIdentity,
  internalTokenHeader,
  withInternalToken,
  type Identity,
} from './auth/identity.ts'
import { createPdfImporter } from './import/pdfImporter.ts'
import {
  CvConflictError,
  CvForbiddenError,
  CvImportError,
  CvOwnerError,
  CvVersionError,
  CvNotFoundError,
  PdfExportError,
} from './services/errors.ts'

z.config(z.locales.fr())

export function createApp(service: CvService, identity: Identity) {
  return new Hono<{ Variables: { user: CurrentUser } }>()
    .basePath('/api')
    .use(async (c, next) => {
      const user = await identity(c.req.raw.headers)
      if (!user)
        return c.text('authentification requise : rechargez la page pour vous reconnecter.', 401)
      c.set('user', user)
      await next()
    })
    .get('/me', (c) => c.json(c.var.user))
    .route('/cvs', createCvRoutes(service))
    .notFound((c) => c.text('ressource introuvable.', 404))
    .onError((error, c) => {
      if (error instanceof HTTPException) return error.getResponse()
      if (error instanceof CvNotFoundError) return c.text(error.message, 404)
      if (error instanceof CvConflictError) return c.text(error.message, 412)
      if (error instanceof CvForbiddenError) return c.text(error.message, 403)
      if (error instanceof CvOwnerError) return c.text(error.message, 409)
      if (error instanceof CvVersionError) return c.text(error.message, 409)
      if (error instanceof CvImportError) return c.text(error.message, 422)
      if (error instanceof PdfExportError) return c.text(error.message, 500)
      console.error(error)
      return c.text('erreur interne du serveur.', 500)
    })
}

type ServerOptions = {
  databaseUrl: string | undefined
  logoFile: string
  baseUrl: () => string
  iapAudience?: string
  devUserEmail?: string
  devUserTitle?: string
  production?: boolean
}

function createIdentity(
  { iapAudience, devUserEmail, devUserTitle, production }: ServerOptions,
  profiles: Profiles | undefined,
) {
  if (iapAudience && profiles)
    return withDirectoryProfiles(createIapIdentity(iapAudience), profiles)
  if (production && !devUserEmail)
    throw new Error(
      'IAP_AUDIENCE est absent : impossible de vérifier l’utilisateur connecté en production.',
    )
  return createFixedIdentity(devUserEmail || 'dev@localhost', devUserTitle || undefined)
}

export function createServerApp(options: ServerOptions) {
  const { databaseUrl, logoFile, baseUrl } = options
  const internalToken = randomUUID()
  const profiles = options.iapAudience ? cacheProfiles(createDirectoryLookup()) : undefined
  const identity = withInternalToken(createIdentity(options, profiles), internalToken)
  const pool = createPool(databaseUrl)
  const pdfRenderer = createPdfRenderer({
    baseUrl,
    logoFile,
    headers: { [internalTokenHeader]: internalToken },
  })
  const service = createCvService(
    createPostgresRepository(pool),
    pdfRenderer,
    createPdfImporter(),
    async (email) => (await profiles?.(email))?.relations ?? [],
  )
  return {
    app: createApp(service, identity),
    migrate: () => migrate(pool),
    close: async () => {
      await Promise.all([pdfRenderer.close(), pool.end()])
    },
  }
}
