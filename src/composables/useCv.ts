import { ref } from 'vue'
import { errorMessage, getCv, getCvPdf, isConflict, saveCv } from '../service/cvApi'
import type { UserData } from '../types'

export type SaveCv = (
  patch: Partial<UserData>,
  options?: { optimistic?: boolean },
) => Promise<boolean>

export function useCv(id: string) {
  const cv = ref<UserData | null>(null)
  const loadError = ref<string | null>(null)
  const saveError = ref<string | null>(null)
  const conflict = ref(false)
  const exportError = ref<string | null>(null)
  const isExporting = ref(false)
  let version = ''
  let saving: Promise<unknown> = Promise.resolve()

  async function load() {
    loadError.value = null
    try {
      const loaded = await getCv(id)
      cv.value = loaded.cv
      version = loaded.version
    } catch (error) {
      loadError.value = errorMessage(error)
    }
  }

  // Shows the change once saved; with `optimistic` it's shown right away and undone on failure
  const save: SaveCv = async (patch, { optimistic = false } = {}) => {
    if (!cv.value) return false
    const previous = cv.value
    const next = { ...previous, ...patch }
    if (optimistic) cv.value = next
    const saved = saving.then(async () => {
      try {
        version = await saveCv(id, next, version)
      } catch (error) {
        saveError.value = errorMessage(error)
        conflict.value = isConflict(error)
        if (optimistic) cv.value = previous
        return false
      }
      saveError.value = null
      cv.value = next
      return true
    })
    saving = saved
    return saved
  }

  async function exportPdf() {
    isExporting.value = true
    exportError.value = null
    try {
      const url = URL.createObjectURL(await getCvPdf(id))
      const link = document.createElement('a')
      link.href = url
      link.download = `cv-${id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      exportError.value = errorMessage(error)
    } finally {
      isExporting.value = false
    }
  }

  return { cv, loadError, load, saveError, conflict, save, exportError, isExporting, exportPdf }
}
