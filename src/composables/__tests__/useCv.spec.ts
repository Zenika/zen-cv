import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCv, getCvPdf, RequestError, saveCv } from '../../service/cvApi'
import type { UserData } from '../../types'
import { useCv } from '../useCv'

vi.mock('../../service/cvApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../service/cvApi')>()
  return {
    ...original,
    getCv: vi.fn<typeof original.getCv>(),
    saveCv: vi.fn<typeof original.saveCv>(),
    getCvPdf: vi.fn<typeof original.getCvPdf>(),
  }
})

const cv = { firstname: 'Camille', name: 'Martin', title: 'Développeuse' } as UserData

afterEach(() => {
  vi.resetAllMocks()
})

async function loaded() {
  vi.mocked(getCv).mockResolvedValue({ cv, version: '"1"' })
  const state = useCv('camille')
  await state.load()
  return state
}

describe('useCv', () => {
  it('loads the CV', async () => {
    const { cv: current, loadError } = await loaded()
    expect(getCv).toHaveBeenCalledWith('camille')
    expect(current.value).toEqual(cv)
    expect(loadError.value).toBeNull()
  })

  it('exposes the load error and clears it on retry', async () => {
    vi.mocked(getCv).mockRejectedValueOnce(new Error('le serveur est injoignable.'))
    const { cv: current, loadError, load } = useCv('camille')
    await load()
    expect(current.value).toBeNull()
    expect(loadError.value).toBe('le serveur est injoignable.')

    vi.mocked(getCv).mockResolvedValue({ cv, version: '"1"' })
    await load()
    expect(current.value).toEqual(cv)
    expect(loadError.value).toBeNull()
  })

  it('saves the merged CV and shows it once saved', async () => {
    const { cv: current, save } = await loaded()
    let resolve!: (version: string) => void
    vi.mocked(saveCv).mockReturnValue(new Promise((done) => (resolve = done)))

    const saving = save({ title: 'Architecte' })
    expect(current.value?.title).toBe('Développeuse')
    resolve('"2"')
    expect(await saving).toBe(true)
    expect(saveCv).toHaveBeenCalledWith('camille', { ...cv, title: 'Architecte' }, '"1"')
    expect(current.value?.title).toBe('Architecte')
  })

  it('sends each save after the previous one, with the version it returned', async () => {
    const { save } = await loaded()
    let resolveFirst!: (version: string) => void
    vi.mocked(saveCv)
      .mockReturnValueOnce(new Promise((done) => (resolveFirst = done)))
      .mockResolvedValueOnce('"3"')

    const first = save({ title: 'Premier' }, { optimistic: true })
    const second = save({ bio: 'Seconde' }, { optimistic: true })
    await Promise.resolve()
    expect(saveCv).toHaveBeenCalledOnce()
    resolveFirst('"2"')
    expect(await Promise.all([first, second])).toEqual([true, true])
    expect(saveCv).toHaveBeenLastCalledWith(
      'camille',
      { ...cv, title: 'Premier', bio: 'Seconde' },
      '"2"',
    )
  })

  it('flags a save refused because someone else changed the CV', async () => {
    const { save, saveError, conflict } = await loaded()
    vi.mocked(saveCv).mockRejectedValueOnce(new RequestError('modifié ailleurs.', 412))
    expect(await save({ title: 'Architecte' })).toBe(false)
    expect(saveError.value).toBe('modifié ailleurs.')
    expect(conflict.value).toBe(true)

    vi.mocked(saveCv).mockRejectedValueOnce(new RequestError('refusé.', 400))
    await save({ title: 'Architecte' })
    expect(conflict.value).toBe(false)
  })

  it('keeps the CV unchanged and exposes the error when saving fails', async () => {
    const { cv: current, save, saveError } = await loaded()
    vi.mocked(saveCv).mockRejectedValue(new Error('refusé.'))
    expect(await save({ title: 'Architecte' })).toBe(false)
    expect(current.value).toEqual(cv)
    expect(saveError.value).toBe('refusé.')

    vi.mocked(saveCv).mockResolvedValue('"2"')
    expect(await save({ title: 'Architecte' })).toBe(true)
    expect(saveError.value).toBeNull()
  })

  it('shows an optimistic change right away and undoes it on failure', async () => {
    const { cv: current, save } = await loaded()
    let reject!: (error: Error) => void
    vi.mocked(saveCv).mockReturnValue(new Promise((_, fail) => (reject = fail)))

    const saving = save({ title: 'Architecte' }, { optimistic: true })
    expect(current.value?.title).toBe('Architecte')
    reject(new Error('refusé.'))
    expect(await saving).toBe(false)
    expect(current.value).toEqual(cv)
  })

  it('does nothing when saving before the CV is loaded', async () => {
    const { save } = useCv('camille')
    expect(await save({ title: 'Architecte' })).toBe(false)
    expect(saveCv).not.toHaveBeenCalled()
  })

  it('downloads the exported PDF', async () => {
    const { exportPdf, isExporting, exportError } = await loaded()
    vi.mocked(getCvPdf).mockResolvedValue(new Blob(['%PDF']))
    URL.createObjectURL = vi.fn<typeof URL.createObjectURL>(() => 'blob:pdf')
    URL.revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.href).toBe('blob:pdf')
      expect(this.download).toBe('cv-camille.pdf')
    })

    const exporting = exportPdf()
    expect(isExporting.value).toBe(true)
    await exporting
    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf')
    expect(isExporting.value).toBe(false)
    expect(exportError.value).toBeNull()
  })

  it('exposes the export error', async () => {
    const { exportPdf, isExporting, exportError } = await loaded()
    vi.mocked(getCvPdf).mockRejectedValue(new Error('le navigateur n’a pas démarré.'))
    await exportPdf()
    expect(exportError.value).toBe('le navigateur n’a pas démarré.')
    expect(isExporting.value).toBe(false)
  })
})
