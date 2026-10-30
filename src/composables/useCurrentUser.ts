import { ref } from 'vue'
import { getCurrentUser } from '../service/cvApi'
import type { CurrentUser } from '../types'

const user = ref<CurrentUser | null>(null)
let loading: Promise<void> | undefined

export function useCurrentUser() {
  loading ??= getCurrentUser().then(
    (current) => {
      user.value = current
    },
    () => {
      loading = undefined
    },
  )
  return user
}
