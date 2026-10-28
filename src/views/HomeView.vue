<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { errorMessage, getCvs } from '../service/cvApi'
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

onMounted(loadCvs)
</script>

<template>
  <div class="cv">
    <main class="home">
      <h1 class="home__title">Les CV</h1>

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
  margin: 0 auto;
  padding: 32px $gutter;

  &__title {
    margin-bottom: 24px;
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
