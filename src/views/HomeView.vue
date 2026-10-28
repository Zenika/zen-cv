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
      <h1 class="cv-section-title home-title">Les CV</h1>

      <div v-if="loadError" class="cv-load-error" role="alert">
        <p><strong>La liste des CV n'a pas pu être chargée :</strong> {{ loadError }}</p>
        <button type="button" class="cv-button cv-button-primary" @click="loadCvs">
          Réessayer
        </button>
      </div>

      <ul v-else-if="cvs" class="home-list">
        <li v-for="cv in cvs" :key="cv.id">
          <RouterLink :to="`/cv/${encodeURIComponent(cv.id)}`" class="cv-card home-card">
            <span class="home-name">
              {{ cv.firstname }} <span class="cv-lastname">{{ cv.name }}</span>
            </span>
            <span class="home-job">{{ cv.title }}</span>
          </RouterLink>
        </li>
      </ul>
    </main>
  </div>
</template>

<style>
.home {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px var(--cv-gutter);
}

.home .home-title {
  margin-bottom: 24px;
  text-align: left;
}

.home-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.home-card {
  display: grid;
  gap: 6px;
  color: inherit;
  text-decoration: none;
  transition: box-shadow 0.15s;
}

.home-card:hover,
.home-card:focus-visible {
  box-shadow: 0 4px 20px rgb(0 0 0 / 20%);
}

.home-name {
  font-family: 'Montserrat', sans-serif;
  font-size: 22px;
  line-height: 1.15;
}

.home-name .cv-lastname {
  display: inline;
}

.home-job {
  color: #555;
}
</style>
