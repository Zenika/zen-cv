<script setup lang="ts">
import { PencilIcon } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import InlineEdit from './InlineEdit.vue'
import type { SaveCv } from '../composables/useCv'
import type { UserData } from '../types'

defineProps<{ cv: UserData; save: SaveCv }>()
</script>

<template>
  <header class="cv-header">
    <div class="cv-header__content">
      <RouterLink to="/" class="back-link">← Tous les CV</RouterLink>
      <h1 class="cv-header__name">
        {{ cv.firstname }}
        <span class="cv-header__lastname">{{ cv.name }}</span>
      </h1>
      <div class="cv-header__title">
        <InlineEdit
          :value="cv.title"
          label="Titre du CV"
          :save="(title) => save({ title })"
          v-slot="{ edit }"
        >
          {{ cv.title }}
          <button
            type="button"
            class="icon-button icon-button--small"
            aria-label="Modifier le titre"
            @click="edit"
          >
            <PencilIcon :size="14" />
          </button>
        </InlineEdit>
      </div>
    </div>
  </header>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.cv-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  max-width: $content-width;
  padding: 20px $gutter;
  margin: 0 auto;

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-family: $font-heading;
    font-size: 32px;
    font-weight: 400;
    line-height: 1.1;
  }

  &__lastname {
    display: block;
    color: $red;
    text-transform: uppercase;
  }

  &__title {
    margin-top: 6px;
    font-family: $font-heading;
    font-size: 18px;
  }
}
</style>
