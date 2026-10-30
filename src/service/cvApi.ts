import type { CvSummary, UserData } from '../types'

async function request(url: string, init?: RequestInit) {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new Error('le serveur est injoignable.')
  }
  if (!response.ok) throw new Error((await response.text()) || `erreur ${response.status}.`)
  return response
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await request(url)
  try {
    return await response.json()
  } catch {
    throw new Error('les données reçues ne sont pas un JSON valide.')
  }
}

const cvUrl = (id: string) => `/api/cvs/${encodeURIComponent(id)}`

export function getCvs() {
  return requestJson<CvSummary[]>('/api/cvs')
}

export function getCv(id: string) {
  return requestJson<UserData>(cvUrl(id))
}

export async function saveCv(id: string, cv: UserData) {
  await request(cvUrl(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cv),
  })
}

export async function deleteCv(id: string) {
  await request(cvUrl(id), { method: 'DELETE' })
}

export type ImportedCv = { id: string; warnings: string[] }

export async function importCvPdf(file: Blob): Promise<ImportedCv> {
  const response = await request('/api/cvs/import', {
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
