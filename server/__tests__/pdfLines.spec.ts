import { describe, expect, it } from 'vitest'
import { createPdfImporter } from '../import/pdfImporter.ts'
import { extractPdfLines } from '../import/pdfLines.ts'
import { CvImportError } from '../services/errors.ts'
import { buildPdf } from './buildPdf.ts'

const helveticaWidth = (text: string, size: number) =>
  ([...text].reduce((total, char) => total + { C: 722, o: 556, n: 556 }[char]!, 0) / 1000) * size

describe('extractPdfLines', () => {
  it('rebuilds lines top-down, page by page', async () => {
    const lines = await extractPdfLines(
      buildPdf([
        [
          { x: 194, y: 100, size: 11, text: 'Second' },
          { x: 194, y: 80, size: 11, text: 'Premier' },
        ],
        [{ x: 194, y: 40, size: 11, text: 'Suite' }],
      ]),
    )
    expect(lines.map(({ page, y, text }) => ({ page, y: Math.round(y), text }))).toEqual([
      { page: 1, y: 80, text: 'Premier' },
      { page: 1, y: 100, text: 'Second' },
      { page: 2, y: 40, text: 'Suite' },
    ])
  })

  it('joins split words and splits columns or font sizes', async () => {
    const lines = await extractPdfLines(
      buildPdf([
        [
          { x: 26, y: 100, size: 11, text: 'Con' },
          { x: 26 + helveticaWidth('Con', 11), y: 100, size: 11, text: 'fluence' },
          { x: 230, y: 100, size: 11, text: 'Certification' },
          { x: 120, y: 200, size: 14, text: 'Client' },
          { x: 165, y: 200, size: 11, text: 'Poste' },
        ],
      ]),
    )
    expect(lines.map(({ x, size, text }) => ({ x: Math.round(x), size, text }))).toEqual([
      { x: 26, size: 11, text: 'Confluence' },
      { x: 230, size: 11, text: 'Certification' },
      { x: 120, size: 14, text: 'Client' },
      { x: 165, size: 11, text: 'Poste' },
    ])
  })

  it('keeps a bullet with its text', async () => {
    const lines = await extractPdfLines(
      buildPdf([
        [
          { x: 203, y: 100, size: 9, text: '-' },
          { x: 221, y: 100, size: 11, text: 'Mise en place' },
        ],
      ]),
    )
    expect(lines).toMatchObject([{ x: 203, size: 11, text: '- Mise en place' }])
  })
})

describe('pdfImporter', () => {
  it('rejects a file that is not a readable PDF', async () => {
    await expect(createPdfImporter().import(new TextEncoder().encode('%PDF-oops'))).rejects.toThrow(
      new CvImportError('le fichier n’a pas pu être lu comme un PDF.'),
    )
  })

  it('rejects a PDF without text', async () => {
    await expect(createPdfImporter().import(buildPdf([[]]))).rejects.toThrow(
      new CvImportError('le PDF ne contient aucun texte.'),
    )
  })
})
