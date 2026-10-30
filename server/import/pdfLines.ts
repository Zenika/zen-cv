import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js'

export type PdfLine = {
  page: number
  x: number
  y: number
  width: number
  size: number
  text: string
}

export const bulletPattern = /^[-–•●○■□▪►o]$/

const isBullet = (text: string) => bulletPattern.test(text.trim())

const sameRow = (a: PdfLine, b: PdfLine) => a.page === b.page && Math.abs(a.y - b.y) < 2

function rowToLines(row: PdfLine[]) {
  const lines: PdfLine[] = []
  for (const fragment of row.sort((a, b) => a.x - b.x)) {
    const line = lines.at(-1)
    const gap = line ? fragment.x - (line.x + line.width) : Infinity
    const split =
      !line || gap > 2 * Math.min(line.size, fragment.size) || line.size !== fragment.size
    if (split && !(line && isBullet(line.text))) {
      lines.push({ ...fragment })
      continue
    }
    line!.text += (gap < fragment.size * 0.15 ? '' : ' ') + fragment.text
    line!.width = fragment.x + fragment.width - line!.x
    line!.size = fragment.size
  }
  return lines
}

export async function extractPdfLines(data: Uint8Array): Promise<PdfLine[]> {
  const loading = getDocument({ data, verbosity: 0 })
  const document = await loading.promise
  const fragments: PdfLine[] = []
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const { items } = await page.getTextContent()
      const pageHeight = page.view[3]!
      for (const item of items as TextItem[]) {
        if (!item.str.trim()) continue
        const [, , , scale, x, y] = item.transform as number[]
        fragments.push({
          page: pageNumber,
          x: x!,
          y: pageHeight - y!,
          width: item.width,
          size: Math.round(scale!),
          text: item.str,
        })
      }
    }
  } finally {
    await loading.destroy()
  }

  fragments.sort((a, b) => a.page - b.page || a.y - b.y)
  const rows: PdfLine[][] = []
  for (const fragment of fragments) {
    const row = rows.at(-1)
    if (row && sameRow(row[0]!, fragment)) row.push(fragment)
    else rows.push([fragment])
  }
  return rows
    .flatMap(rowToLines)
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() }))
}
