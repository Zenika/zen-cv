import type { CurrentUser, CvSummary, CvVersion, UserData } from '../../shared/cv.ts'
import { isSameName } from '../../shared/names.ts'
import type { PdfImporter } from '../import/pdfImporter.ts'
import type { PdfRenderer } from '../pdf/pdfRenderer.ts'
import type { CvRepository, VersionedCv } from '../repository/cvRepository.ts'
import { missingValue, splitName } from '../import/parseCv.ts'
import { canEdit, type RelationsOf } from '../auth/permissions.ts'
import {
  CvConflictError,
  CvForbiddenError,
  CvNotFoundError,
  CvOwnerError,
  CvVersionError,
} from './errors.ts'

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

const alreadyOwner = 'vous avez déjà un CV : supprimez-le avant d’en importer un autre.'

export type CvService = ReturnType<typeof createCvService>

export function createCvService(
  repository: CvRepository,
  pdfRenderer: Pick<PdfRenderer, 'render'>,
  pdfImporter: PdfImporter,
  relationsOf: RelationsOf = async () => [],
) {
  async function get(id: string) {
    const cv = await repository.get(id)
    if (!cv) throw new CvNotFoundError(id)
    return cv
  }

  const sourceOf = async (stored: VersionedCv) =>
    stored.sourceId ? await get(stored.sourceId) : stored

  const editable = async (stored: VersionedCv, user: CurrentUser) =>
    canEdit(user, (await sourceOf(stored)).ownerEmail, relationsOf)

  async function assertCanEdit(id: string, user: CurrentUser) {
    const stored = await get(id)
    if (!(await editable(stored, user))) throw new CvForbiddenError()
    return stored
  }

  return {
    async get(id: string, user: CurrentUser) {
      const stored = await get(id)
      return { ...stored, editable: await editable(stored, user) }
    },

    async versions(id: string): Promise<CvVersion[]> {
      const sourceId = (await get(id)).sourceId ?? id
      return [{ id: sourceId, label: null }, ...(await repository.versions(sourceId))]
    },

    async createVersion(id: string, label: string, user: CurrentUser) {
      const { cv, sourceId } = await assertCanEdit(id, user)
      const source = { id: sourceId ?? id, label }
      for (let number = 2; ; number++) {
        const versionId = `${source.id}-v${number}`
        if ((await repository.create(versionId, cv, undefined, source)) === 'created')
          return { id: versionId }
      }
    },

    async rename(id: string, label: string, user: CurrentUser) {
      const stored = await assertCanEdit(id, user)
      if (!stored.sourceId || !(await repository.setLabel(id, label)))
        throw new CvVersionError('le CV principal n’a pas de label.')
    },

    async list(): Promise<CvSummary[]> {
      return (await repository.list())
        .filter(({ sourceId }) => !sourceId)
        .map(({ id, cv: { firstname, name, title }, ownerEmail }) => ({
          id,
          firstname,
          name,
          title,
          ownerEmail,
        }))
    },

    async replace(id: string, cv: UserData, version: number, user: CurrentUser) {
      await assertCanEdit(id, user)
      const result = await repository.update(id, cv, version)
      if (result === 'not-found') throw new CvNotFoundError(id)
      if (result === 'conflict') throw new CvConflictError()
      return result.version
    },

    async claim(id: string, user: CurrentUser) {
      if ((await get(id)).sourceId)
        throw new CvOwnerError('une version a le propriétaire de son CV principal.')
      const result = await repository.setOwner(id, user.email.toLowerCase())
      if (result === 'not-found') throw new CvNotFoundError(id)
      if (result === 'already-owned')
        throw new CvOwnerError('ce CV appartient déjà à quelqu’un d’autre.')
      if (result === 'owner-taken') throw new CvOwnerError(alreadyOwner)
    },

    async delete(id: string, user: CurrentUser) {
      await assertCanEdit(id, user)
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
        const result = await repository.create(id, cv, owner?.email.toLowerCase())
        if (result === 'owner-taken') throw new CvOwnerError(alreadyOwner)
        if (result === 'created') return { id, warnings }
      }
    },

    async exportPdf(id: string) {
      await get(id)
      return pdfRenderer.render(id)
    },
  }
}
