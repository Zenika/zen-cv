import { computed, ref } from 'vue'
import { createVersion, errorMessage, getVersions, renameVersion } from '../service/cvApi'
import type { CvVersion } from '../types'

export function useCvVersions(id: string) {
  const versions = ref<CvVersion[]>([])
  const versionError = ref<string | null>(null)
  const mainId = computed(() => versions.value[0]?.id ?? id)
  const current = computed(() => versions.value.find((version) => version.id === id))

  async function load() {
    try {
      versions.value = await getVersions(id)
    } catch (error) {
      versionError.value = errorMessage(error)
    }
  }

  async function create(label: string) {
    versionError.value = null
    try {
      return (await createVersion(id, label)).id
    } catch (error) {
      versionError.value = errorMessage(error)
      return null
    }
  }

  async function rename(label: string) {
    versionError.value = null
    try {
      await renameVersion(id, label)
      versions.value = versions.value.map((version) =>
        version.id === id ? { ...version, label } : version,
      )
      return true
    } catch (error) {
      versionError.value = errorMessage(error)
      return false
    }
  }

  return { versions, versionError, mainId, current, load, create, rename }
}
