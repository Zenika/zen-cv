<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { isSameName, matchesSearch } from '../../shared/names.ts'
import { useCurrentUser } from '../composables/useCurrentUser'
import { claimCv, errorMessage, getCvs, importCvPdf } from '../service/cvApi'
import type { CvSummary } from '../types'

const cvs = ref<CvSummary[] | null>(null)
const loadError = ref<string | null>(null)

const route = useRoute()
const router = useRouter()
const query = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q) => router.replace({ query: q ? { q } : {} }),
})
const filteredCvs = computed(() => cvs.value?.filter((cv) => matchesSearch(query.value, cv)) ?? [])

async function loadCvs() {
  loadError.value = null
  try {
    cvs.value = await getCvs()
  } catch (error) {
    loadError.value = errorMessage(error)
  }
}

const user = useCurrentUser()
const skipKey = computed(() => `zen-cv:passer-accueil:${user.value?.email}`)
const skipped = ref(false)
const isMine = (cv: CvSummary) => cv.ownerEmail === user.value?.email.toLowerCase()
const candidates = computed(() => {
  const name = user.value?.name
  return name ? (cvs.value ?? []).filter((cv) => !cv.ownerEmail && isSameName(name, cv)) : []
})
const showWelcome = computed(
  () =>
    user.value !== null &&
    cvs.value !== null &&
    !skipped.value &&
    localStorage.getItem(skipKey.value) === null &&
    !cvs.value.some(isMine),
)
const claimError = ref<string | null>(null)

async function claim(cv: CvSummary) {
  claimError.value = null
  try {
    await claimCv(cv.id)
    await loadCvs()
  } catch (error) {
    claimError.value = errorMessage(error)
  }
}

function skipWelcome() {
  localStorage.setItem(skipKey.value, new Date().toISOString())
  skipped.value = true
}

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
        <template v-if="candidates.length">
          <p>Nous avons trouvé un CV à votre nom. Est-ce le vôtre ?</p>
          <ul class="home__candidates">
            <li v-for="cv in candidates" :key="cv.id" class="home__candidate">
              <RouterLink :to="`/cv/${encodeURIComponent(cv.id)}`" class="home__candidate-link">
                {{ cv.firstname }} {{ cv.name }}</RouterLink
              >
              <button type="button" class="button button--primary" @click="claim(cv)">
                C'est mon CV
              </button>
            </li>
          </ul>
          <p v-if="claimError" class="home__claim-error" role="alert">
            <strong>Le CV n'a pas pu vous être attribué :</strong> {{ claimError }}
          </p>
          <p>Sinon, importez votre CV Zenika au format PDF.</p>
        </template>
        <p v-else>
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

      <template v-else-if="cvs">
        <div class="home__search">
          <input
            v-model="query"
            type="search"
            class="home__search-input"
            aria-label="Rechercher un CV par nom"
            placeholder="Rechercher un CV par nom…"
          />
          <p class="home__count" aria-live="polite">
            {{ filteredCvs.length }} CV{{ filteredCvs.length > 1 ? 's' : '' }}
          </p>
        </div>

        <ul v-if="filteredCvs.length" class="home__list">
          <li v-for="cv in filteredCvs" :key="cv.id">
            <RouterLink :to="`/cv/${encodeURIComponent(cv.id)}`" class="card home__card">
              <span class="home__name">
                {{ cv.firstname }} <span class="home__lastname">{{ cv.name }}</span>
              </span>
              <span v-if="isMine(cv)" class="home__mine">Mon CV</span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="home__empty">Aucun CV ne correspond à « {{ query }} ».</p>
      </template>
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

  &__search {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    margin-bottom: 20px;
  }

  &__search-input {
    flex: 0 1 420px;
    min-width: 0;
    padding: 8px 12px;
    font: inherit;
    color: inherit;
    border: 1px solid $border;
    border-radius: 4px;
  }

  &__count {
    color: $muted;
  }

  &__empty {
    color: $muted;
  }

  &__mine {
    justify-self: start;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: $red;
    border-radius: 4px;
  }

  &__candidates {
    display: grid;
    gap: 8px;
  }

  &__candidate {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    align-items: center;
  }

  &__candidate-link {
    font-weight: 600;
    color: inherit;
  }

  &__claim-error {
    color: $red;
  }
}
</style>
