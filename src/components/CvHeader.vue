<script setup lang="ts">
import { RouterLink } from 'vue-router'
import InlineEdit from './InlineEdit.vue'
import type { SaveCv } from '../composables/useCv'
import type { UserData } from '../types'

defineProps<{ cv: UserData; save: SaveCv }>()
</script>

<template>
  <header class="cv-header">
    <div>
      <RouterLink to="/" class="cv-back">← Tous les CV</RouterLink>
      <h1>
        {{ cv.firstname }}
        <span class="cv-lastname">{{ cv.name }}</span>
      </h1>
      <div class="cv-title">
        <InlineEdit
          :value="cv.title"
          label="Titre du CV"
          :save="(title) => save({ title })"
          v-slot="{ edit }"
        >
          {{ cv.title }}
          <button type="button" class="cv-icon-button" aria-label="Modifier le titre" @click="edit">
            ✎
          </button>
        </InlineEdit>
      </div>
      <ul class="cv-links">
        <template v-for="links in cv.links">
          <li v-for="(url, name) in links" :key="name">
            <a :href="url">{{ name }}</a>
          </li>
        </template>
      </ul>
    </div>
  </header>
</template>

<style>
.cv-header {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  max-width: 860px;
  margin: 0 auto;
  padding: 20px var(--cv-gutter);
}

.cv-header > div {
  flex: 1;
  min-width: 0;
}

.cv h1 {
  font-size: 32px;
  line-height: 1.1;
}

.cv-title {
  margin-top: 6px;
  font-family: 'Montserrat', sans-serif;
  font-size: 18px;
}

.cv-title .cv-inline-edit-actions {
  font-family: 'Open Sans', sans-serif;
  font-size: 15px;
}

.cv-title .cv-icon-button {
  width: auto;
  height: auto;
  padding: 2px 6px;
  font-size: 16px;
  line-height: normal;
}

.cv-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px !important;
  font-size: 13px;
}

.cv-links a {
  color: var(--cv-red);
}
</style>
