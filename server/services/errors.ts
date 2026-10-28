export class CvNotFoundError extends Error {
  constructor(id: string) {
    super(`aucun CV ne correspond à « ${id} ».`)
    this.name = 'CvNotFoundError'
  }
}

export class PdfExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfExportError'
  }
}
