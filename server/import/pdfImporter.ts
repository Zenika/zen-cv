import { cvSchema } from '../../shared/cv.ts'
import { CvImportError } from '../services/errors.ts'
import { parseCv, type ParsedCv } from './parseCv.ts'
import { extractPdfLines } from './pdfLines.ts'

export type PdfImporter = {
  import(pdf: Uint8Array): Promise<ParsedCv>
}

export function createPdfImporter(): PdfImporter {
  return {
    async import(pdf) {
      let lines
      try {
        lines = await extractPdfLines(pdf)
      } catch {
        throw new CvImportError('le fichier n’a pas pu être lu comme un PDF.')
      }
      if (!lines.length) throw new CvImportError('le PDF ne contient aucun texte.')
      const { cv, warnings } = parseCv(lines)
      const result = cvSchema.safeParse(cv)
      if (!result.success)
        throw new CvImportError('le contenu du PDF ne correspond pas au modèle de CV Zenika.')
      return { cv: result.data, warnings }
    },
  }
}
