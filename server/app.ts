import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { createPdfRenderer } from './pdf/pdfRenderer.ts'
import { createJsonRepository } from './repository/jsonRepository.ts'
import { createCvRoutes } from './routes/cvs.ts'
import { createCvService, type CvService } from './services/cvService.ts'
import { CvNotFoundError, PdfExportError } from './services/errors.ts'

z.config(z.locales.fr())

export function createApp(service: CvService) {
  return new Hono()
    .basePath('/api')
    .route('/cvs', createCvRoutes(service))
    .notFound((c) => c.text('ressource introuvable.', 404))
    .onError((error, c) => {
      if (error instanceof HTTPException) return error.getResponse()
      if (error instanceof CvNotFoundError) return c.text(error.message, 404)
      if (error instanceof PdfExportError) return c.text(error.message, 500)
      console.error(error)
      return c.text('erreur interne du serveur.', 500)
    })
}

type ServerOptions = {
  databaseFile: string
  logoFile: string
  baseUrl: () => string
}

export function createServerApp({ databaseFile, logoFile, baseUrl }: ServerOptions) {
  const pdfRenderer = createPdfRenderer({ baseUrl, logoFile })
  const service = createCvService(createJsonRepository(databaseFile), pdfRenderer)
  return { app: createApp(service), close: () => pdfRenderer.close() }
}
