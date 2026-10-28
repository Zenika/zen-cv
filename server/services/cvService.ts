import type { CvSummary, UserData } from '../../shared/cv.ts'
import type { PdfRenderer } from '../pdf/pdfRenderer.ts'
import type { CvRepository } from '../repository/cvRepository.ts'
import { CvNotFoundError } from './errors.ts'

export type CvService = ReturnType<typeof createCvService>

export function createCvService(
  repository: CvRepository,
  pdfRenderer: Pick<PdfRenderer, 'render'>,
) {
  async function get(id: string) {
    const cv = await repository.get(id)
    if (!cv) throw new CvNotFoundError(id)
    return cv
  }

  return {
    get,

    async list(): Promise<CvSummary[]> {
      return (await repository.list()).map(({ id, cv: { firstname, name, title } }) => ({
        id,
        firstname,
        name,
        title,
      }))
    },

    async replace(id: string, cv: UserData) {
      await get(id)
      await repository.save(id, cv)
    },

    async exportPdf(id: string) {
      await get(id)
      return pdfRenderer.render(id)
    },
  }
}
