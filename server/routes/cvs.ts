import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { cvSchema } from '../../shared/cv.ts'
import type { CvService } from '../services/cvService.ts'

export function createCvRoutes(service: CvService) {
  return new Hono()
    .get('/', async (c) => c.json(await service.list()))
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
    .get('/:id/pdf', async (c) => {
      const id = c.req.param('id')
      const pdf = await service.exportPdf(id)
      return c.body(new Uint8Array(pdf), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cv-${encodeURIComponent(id)}.pdf"`,
      })
    })
}
