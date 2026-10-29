import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorMessage, getCv, getCvPdf, getCvs, saveCv } from '../cvApi'
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

  it('sends the whole CV as JSON when saving', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const cv = { firstname: 'A' } as UserData
    await saveCv('a', cv)
    expect(fetchMock).toHaveBeenCalledWith('/api/cvs/a', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cv),
    })
  })

  it('returns the PDF as a blob', async () => {
    fetchMock.mockResolvedValue(new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } }))
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
