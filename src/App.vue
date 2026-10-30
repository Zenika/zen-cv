<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import { getCurrentUser } from './service/cvApi'
import type { CurrentUser } from './types'

const user = ref<CurrentUser | null>(null)

onMounted(async () => {
  try {
    user.value = await getCurrentUser()
  } catch {
    user.value = null
  }
})
</script>

<template>
  <p v-if="user" class="app-user">
    Connecté en tant que <strong class="app-user__name" :title="user.email">{{ user.name }}</strong>
  </p>
  <!-- Keyed so switching CV mounts a fresh page instead of reusing the previous one's state -->
  <RouterView :key="$route.fullPath" />
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.app-user {
  padding: 6px $gutter;
  margin: 0;
  font-family: $font-body;
  font-size: 13px;
  color: $muted;
  text-align: right;
  background: $grey;

  @media print {
    display: none;
  }
}
</style>
