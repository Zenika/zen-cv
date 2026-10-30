import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import { cvSchema } from '../../shared/cv.ts'
import type { CvService } from '../services/cvService.ts'

export function createCvRoutes(service: CvService) {
  return new Hono()
    .get('/', async (c) => c.json(await service.list()))
    .post(
      '/import',
      bodyLimit({
        maxSize: 10 * 1024 * 1024,
        onError: (c) => c.text('le PDF dépasse la taille maximale de 10 Mo.', 413),
      }),
      async (c) => {
        const pdf = new Uint8Array(await c.req.arrayBuffer())
        if (new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-')
          return c.text('le fichier envoyé n’est pas un PDF.', 400)
        return c.json(await service.importPdf(pdf), 201)
      },
    )
    .get('/:id', async (c) => c.json(await service.get(c.req.param('id'))))
    .put(
      '/:id',
      zValidator('json', cvSchema, (result, c) => {
        if (!result.success) return c.text(z.prettifyError(result.error), 400)
      }),
      async (c) => {
        await service.replace(c.req.param('id'), c.req.valid('json'))
        return c.body(null, 204)
      },
    )
    .delete('/:id', async (c) => {
      await service.delete(c.req.param('id'))
      return c.body(null, 204)
    })
    .get('/:id/pdf', async (c) => {
      const id = c.req.param('id')
      const pdf = await service.exportPdf(id)
      return c.body(new Uint8Array(pdf), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cv-${encodeURIComponent(id)}.pdf"`,
      })
    })
}
