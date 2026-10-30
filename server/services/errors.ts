export class CvNotFoundError extends Error {
  constructor(id: string) {
    super(`aucun CV ne correspond à « ${id} ».`)
    this.name = 'CvNotFoundError'
  }
}

export class CvConflictError extends Error {
  constructor() {
    super(
      'ce CV a été modifié par quelqu’un d’autre depuis que vous l’avez ouvert. Rechargez-le pour voir ses modifications.',
    )
    this.name = 'CvConflictError'
  }
}

export class PdfExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfExportError'
  }
}

export class CvImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CvImportError'
  }
}
