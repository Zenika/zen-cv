import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  claimCv,
  deleteCv,
  errorMessage,
  getCv,
  isConflict,
  getCvPdf,
  getCvs,
  importCvPdf,
  saveCv,
} from '../cvApi'
import type { UserData } from '../../types'

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

describe('cvApi', () => {
  it('fetches the CV list', async () => {
    fetchMock.mockResolvedValue(Response.json([{ id: 'a', firstname: 'A', name: 'B', title: 'C' }]))
    expect(await getCvs()).toEqual([{ id: 'a', firstname: 'A', name: 'B', title: 'C' }])
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs', undefined)
  })

  it('encodes the CV id in the URL', async () => {
    fetchMock.mockResolvedValue(Response.json({}))
    await getCv('a/b c')
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/a%2Fb%20c', undefined)
  })

  it('returns the CV with its version and whether I can edit it', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ firstname: 'A' }, { headers: { ETag: '"3"', Allow: 'GET, PUT, DELETE' } }),
    )
    expect(await getCv('a')).toEqual({ cv: { firstname: 'A' }, version: '"3"', editable: true })
    fetchMock.mockResolvedValue(Response.json({}, { headers: { Allow: 'GET' } }))
    expect((await getCv('a')).editable).toBe(false)
  })

  it('sends the whole CV as JSON with the version it replaces, and returns the new one', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204, headers: { ETag: '"4"' } }))
    const cv = { firstname: 'A' } as UserData
    expect(await saveCv('a', cv, '"3"')).toBe('"4"')
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/a', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"3"' },
      body: JSON.stringify(cv),
    })
  })

  it('recognises a save refused because someone else changed the CV', async () => {
    fetchMock.mockResolvedValue(new Response('modifié par quelqu’un d’autre.', { status: 412 }))
    const error = await saveCv('a', {} as UserData, '"3"').catch((error: unknown) => error)
    expect(isConflict(error)).toBe(true)
    expect(errorMessage(error)).toBe('modifié par quelqu’un d’autre.')

    fetchMock.mockResolvedValue(new Response('refusé.', { status: 400 }))
    expect(
      isConflict(await saveCv('a', {} as UserData, '"3"').catch((error: unknown) => error)),
    ).toBe(false)
  })

  it('sends the PDF to import and returns the new id with the warnings', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'a', warnings: ['Nom à vérifier.'] }))
    const file = new Blob(['%PDF'], { type: 'application/pdf' })
    expect(await importCvPdf(file)).toEqual({ id: 'a', warnings: ['Nom à vérifier.'] })
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    })
  })

  it('claims the CV for the signed-in user', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await claimCv('a/b')
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/a%2Fb/claim', { method: 'POST' })
  })

  it('deletes the CV', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await deleteCv('a/b')
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/a%2Fb', { method: 'DELETE' })
  })

  it('imports a PDF as the signed-in user own CV', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'a', warnings: [] }))
    const file = new Blob(['%PDF'], { type: 'application/pdf' })
    await importCvPdf(file, { mine: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/import?owner=me', expect.anything())
  })

  it('returns the PDF as a blob', async () => {
    fetchMock.mockResolvedValue(
      new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } }),
    )
    const pdf = await getCvPdf('a')
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/a/pdf', undefined)
    expect(await pdf.text()).toBe('%PDF')
  })

  it('uses the server message when the request fails', async () => {
    fetchMock.mockResolvedValue(new Response('aucun CV ne correspond.', { status: 404 }))
    await expect(getCv('a')).rejects.toThrow('aucun CV ne correspond.')
  })

  it('falls back to the status when the server sends no message', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
    await expect(getCv('a')).rejects.toThrow('erreur 500.')
  })

  it('reports an unreachable server', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getCvs()).rejects.toThrow('le serveur est injoignable.')
  })

  it('reports an invalid JSON response', async () => {
    fetchMock.mockResolvedValue(new Response('<html>'))
    await expect(getCvs()).rejects.toThrow('les données reçues ne sont pas un JSON valide.')
  })

  it('turns any thrown value into a message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('boom')).toBe('boom')
  })
})
