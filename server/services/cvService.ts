import type { CurrentUser, CvSummary, UserData } from '../../shared/cv.ts'
import { isSameName } from '../../shared/names.ts'
import type { PdfImporter } from '../import/pdfImporter.ts'
import type { PdfRenderer } from '../pdf/pdfRenderer.ts'
import type { CvRepository } from '../repository/cvRepository.ts'
import { missingValue, splitName } from '../import/parseCv.ts'
import { CvConflictError, CvNotFoundError } from './errors.ts'

function slugify(parts: string[]) {
  return (
    parts
      .join('-')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'cv'
  )
}

export type CvService = ReturnType<typeof createCvService>

export function createCvService(
  repository: CvRepository,
  pdfRenderer: Pick<PdfRenderer, 'render'>,
  pdfImporter: PdfImporter,
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

    async replace(id: string, cv: UserData, version: number) {
      const result = await repository.update(id, cv, version)
      if (result === 'not-found') throw new CvNotFoundError(id)
      if (result === 'conflict') throw new CvConflictError()
      return result.version
    },

    async delete(id: string) {
      if (!(await repository.delete(id))) throw new CvNotFoundError(id)
    },

    async importPdf(pdf: Uint8Array, owner?: CurrentUser) {
      const imported = await pdfImporter.import(pdf)
      let { cv, warnings } = imported
      const ownerName = owner && splitName(owner.name)
      if (ownerName && !isSameName(owner.name, cv)) {
        cv = { ...cv, ...ownerName }
        warnings = [
          `Nom repris de votre compte : « ${owner.name} » (le PDF indiquait « ${imported.cv.firstname} ${imported.cv.name} »).`,
          ...warnings.filter((warning) => !warning.startsWith('Le nom « ')),
        ]
      }
      const base = slugify([cv.firstname, cv.name].filter((part) => part !== missingValue))
      for (let attempt = 1; ; attempt++) {
        const id = attempt === 1 ? base : `${base}-${attempt}`
        if (await repository.create(id, cv)) return { id, warnings }
      }
    },

    async exportPdf(id: string) {
      await get(id)
      return pdfRenderer.render(id)
    },
  }
}
