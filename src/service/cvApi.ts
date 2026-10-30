import type { CurrentUser, CvSummary, CvVersion, UserData } from '../types'

export class RequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request(url: string, init?: RequestInit) {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new Error('le serveur est injoignable.')
  }
  if (!response.ok)
    throw new RequestError((await response.text()) || `erreur ${response.status}.`, response.status)
  return response
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return await response.json()
  } catch {
    throw new Error('les données reçues ne sont pas un JSON valide.')
  }
}

async function requestJson<T>(url: string): Promise<T> {
  return readJson<T>(await request(url))
}

export const isConflict = (error: unknown) => error instanceof RequestError && error.status === 412

const cvUrl = (id: string) => `/api/cvs/${encodeURIComponent(id)}`

export function getCurrentUser() {
  return requestJson<CurrentUser>('/api/me')
}

export function getCvs() {
  return requestJson<CvSummary[]>('/api/cvs')
}

export async function getCv(id: string) {
  const response = await request(cvUrl(id))
  return {
    cv: await readJson<UserData>(response),
    version: response.headers.get('ETag') ?? '',
    editable: /\bPUT\b/.test(response.headers.get('Allow') ?? ''),
  }
}

export async function saveCv(id: string, cv: UserData, version: string) {
  const response = await request(cvUrl(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': version },
    body: JSON.stringify(cv),
  })
  return response.headers.get('ETag') ?? ''
}

export function getVersions(id: string) {
  return requestJson<CvVersion[]>(`${cvUrl(id)}/versions`)
}

const jsonLabel = (method: string, label: string): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ label }),
})

export async function createVersion(id: string, label: string) {
  return readJson<{ id: string }>(await request(`${cvUrl(id)}/versions`, jsonLabel('POST', label)))
}

export async function renameVersion(id: string, label: string) {
  await request(`${cvUrl(id)}/label`, jsonLabel('PUT', label))
}

export async function claimCv(id: string) {
  await request(`${cvUrl(id)}/claim`, { method: 'POST' })
}

export async function deleteCv(id: string) {
  await request(cvUrl(id), { method: 'DELETE' })
}

export type ImportedCv = { id: string; warnings: string[] }

export async function importCvPdf(file: Blob, { mine = false } = {}): Promise<ImportedCv> {
  const response = await request(`/api/cvs/import${mine ? '?owner=me' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: file,
  })
  return response.json()
}

export async function getCvPdf(id: string) {
  return (await request(`${cvUrl(id)}/pdf`)).blob()
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
