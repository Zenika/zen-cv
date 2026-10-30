<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { isSameName } from '../../shared/names.ts'
import { useCurrentUser } from '../composables/useCurrentUser'
import { errorMessage, getCvs, importCvPdf } from '../service/cvApi'
import type { CvSummary } from '../types'

const cvs = ref<CvSummary[] | null>(null)
const loadError = ref<string | null>(null)

async function loadCvs() {
  loadError.value = null
  try {
    cvs.value = await getCvs()
  } catch (error) {
    loadError.value = errorMessage(error)
  }
}

const user = useCurrentUser()
const skipKey = computed(() => `zen-cv:passer-import:${user.value?.email}`)
const skipped = ref(false)
const showWelcome = computed(
  () =>
    user.value !== null &&
    cvs.value !== null &&
    !skipped.value &&
    localStorage.getItem(skipKey.value) === null &&
    !cvs.value.some((cv) => isSameName(user.value!.name, cv)),
)

function skipWelcome() {
  localStorage.setItem(skipKey.value, new Date().toISOString())
  skipped.value = true
}

const router = useRouter()
const isImporting = ref(false)
const importError = ref<string | null>(null)

async function importPdf(event: Event, mine = false) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  isImporting.value = true
  importError.value = null
  try {
    const { id, warnings } = await importCvPdf(file, { mine })
    await router.push({
      path: `/cv/${encodeURIComponent(id)}`,
      state: { importWarnings: warnings },
    })
  } catch (error) {
    importError.value = errorMessage(error)
  } finally {
    isImporting.value = false
    input.value = ''
  }
}

onMounted(loadCvs)
</script>

<template>
  <div class="cv">
    <main class="home">
      <div class="home__header">
        <h1 class="home__title">Les CV</h1>
        <label class="button button--primary home__import" :aria-disabled="isImporting">
          {{ isImporting ? 'Import en cours…' : 'Importer un PDF' }}
          <input
            type="file"
            accept="application/pdf"
            class="home__file"
            :disabled="isImporting"
            @change="importPdf($event)"
          />
        </label>
      </div>

      <section v-if="showWelcome" class="card home__welcome" aria-labelledby="welcome-title">
        <h2 id="welcome-title" class="home__welcome-title">Bienvenue {{ user!.name }} !</h2>
        <p>
          Aucun CV à votre nom pour l'instant. Importez votre CV Zenika au format PDF : il sera
          repris ici, prêt à être relu et complété.
        </p>
        <div class="home__welcome-actions">
          <label class="button button--primary home__import" :aria-disabled="isImporting">
            {{ isImporting ? 'Import en cours…' : 'Importer mon CV (PDF)' }}
            <input
              type="file"
              accept="application/pdf"
              class="home__file"
              :disabled="isImporting"
              @change="importPdf($event, true)"
            />
          </label>
          <button type="button" class="button" @click="skipWelcome">Plus tard</button>
        </div>
      </section>

      <p v-if="importError" class="home__import-error" role="alert">
        <strong>Le PDF n'a pas pu être importé :</strong> {{ importError }}
      </p>

      <div v-if="loadError" class="load-error" role="alert">
        <p class="load-error__message">
          <strong>La liste des CV n'a pas pu être chargée :</strong> {{ loadError }}
        </p>
        <button type="button" class="button button--primary load-error__retry" @click="loadCvs">
          Réessayer
        </button>
      </div>

      <ul v-else-if="cvs" class="home__list">
        <li v-for="cv in cvs" :key="cv.id">
          <RouterLink :to="`/cv/${encodeURIComponent(cv.id)}`" class="card home__card">
            <span class="home__name">
              {{ cv.firstname }} <span class="home__lastname">{{ cv.name }}</span>
            </span>
            <span class="home__job">{{ cv.title }}</span>
          </RouterLink>
        </li>
      </ul>
    </main>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.home {
  max-width: $content-width;
  padding: 32px $gutter;
  margin: 0 auto;

  &__header {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  &__import {
    position: relative;
    cursor: pointer;

    &:focus-within {
      outline: 2px solid $text;
      outline-offset: 2px;
    }

    &[aria-disabled='true'] {
      cursor: progress;
      opacity: 0.7;
    }
  }

  &__welcome {
    display: grid;
    gap: 12px;
    margin-bottom: 24px;
    border-left: 4px solid $red;
  }

  &__welcome-title {
    font-family: $font-heading;
    font-size: 20px;
    font-weight: 400;
  }

  &__welcome-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__import-error {
    padding: 12px 16px;
    margin-bottom: 24px;
    border-left: 4px solid $red;
  }

  &__file {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  &__title {
    font-family: $font-heading;
    font-size: 32px;
    font-weight: 400;
    line-height: 1.1;
    text-transform: uppercase;
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 20px;
  }

  &__card {
    display: grid;
    gap: 6px;
    color: inherit;
    text-decoration: none;
    transition: box-shadow 0.15s;

    &:hover,
    &:focus-visible {
      box-shadow: 0 4px 20px rgb(0 0 0 / 20%);
    }
  }

  &__name {
    font-family: $font-heading;
    font-size: 22px;
    line-height: 1.15;
  }

  &__lastname {
    color: $red;
    text-transform: uppercase;
  }

  &__job {
    color: #555;
  }
}
</style>
