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

export class CvOwnerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CvOwnerError'
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

export class CvForbiddenError extends Error {
  constructor() {
    super(
      'vous ne pouvez pas modifier ce CV : seuls son propriétaire, son manager, les Business Developers et les Directeurs d’agence le peuvent.',
    )
    this.name = 'CvForbiddenError'
  }
}

export class CvVersionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CvVersionError'
  }
}
