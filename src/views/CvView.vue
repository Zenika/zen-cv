<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import CvExperiences from '../components/CvExperiences.vue'
import CvHeader from '../components/CvHeader.vue'
import CvSkills from '../components/CvSkills.vue'
import InlineEdit from '../components/InlineEdit.vue'
import { useCv } from '../composables/useCv'

const props = defineProps<{ id: string }>()

const { cv, loadError, load, saveError, save, exportError, isExporting, exportPdf } = useCv(
  props.id,
)

onMounted(load)
</script>

<template>
  <div class="cv" v-if="cv">
    <button
      type="button"
      class="cv-button cv-button-primary cv-export"
      :disabled="isExporting"
      @click="exportPdf"
    >
      {{ isExporting ? 'Export en cours…' : 'Export PDF' }}
    </button>

    <CvHeader :cv="cv" :save="save" />

    <div class="cv-intro">
      <div class="cv-card cv-bio-card">
        <InlineEdit
          :value="cv.bio"
          label="Bio"
          multiline
          :save="(bio) => save({ bio })"
          v-slot="{ edit }"
        >
          <button type="button" class="cv-icon-button" aria-label="Modifier la bio" @click="edit">
            ✎
          </button>
          <p class="cv-bio">{{ cv.bio }}</p>
        </InlineEdit>
      </div>
    </div>

    <CvSkills :cv="cv" />

    <main class="cv-body">
      <CvExperiences
        :experiences="cv.experiences"
        :save="save"
        :save-error="saveError"
        @clear-save-error="saveError = null"
      />

      <section class="cv-row cv-card">
        <h2 class="cv-section-title">Formation</h2>
        <div>
          <hr />
          <p v-for="education in cv.education" :key="education.title">
            {{ education.period }} <strong>{{ education.title }}</strong
            >, {{ education.school }}.
          </p>
        </div>
      </section>

      <section class="cv-row cv-card">
        <h2 class="cv-section-title">Langues</h2>
        <div>
          <hr />
          <p>
            <template v-for="(language, index) in cv.languages" :key="language.name">
              <template v-if="index">, </template>
              {{ language.name }} ({{ language.level }})
            </template>
          </p>
        </div>
      </section>
    </main>

    <footer class="cv-footer">
      <img src="/images/zenika.png" alt="Zenika" />
    </footer>

    <div class="cv-errors">
      <div v-if="saveError" class="cv-error" role="alert">
        <p><strong>L'enregistrement a échoué :</strong> {{ saveError }}</p>
        <button type="button" class="cv-icon-button" aria-label="Fermer" @click="saveError = null">
          ×
        </button>
      </div>
      <div v-if="exportError" class="cv-error" role="alert">
        <p><strong>L'export PDF a échoué :</strong> {{ exportError }}</p>
        <button
          type="button"
          class="cv-icon-button"
          aria-label="Fermer"
          @click="exportError = null"
        >
          ×
        </button>
      </div>
    </div>
  </div>
  <div v-else-if="loadError" class="cv" role="alert">
    <div class="cv-load-error">
      <RouterLink to="/" class="cv-back">← Tous les CV</RouterLink>
      <p><strong>Le CV n'a pas pu être chargé :</strong> {{ loadError }}</p>
      <button type="button" class="cv-button cv-button-primary" @click="load">Réessayer</button>
    </div>
  </div>
</template>

<style>
.cv-export {
  position: absolute;
  top: 20px;
  right: var(--cv-gutter);
}

.cv-intro {
  max-width: 860px;
  margin: 0 auto;
  padding: 0 var(--cv-gutter) 20px;
}

.cv-bio-card {
  position: relative;
}

.cv-bio-card > .cv-icon-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: auto;
  height: auto;
  padding: 2px 6px;
  font-size: 16px;
  line-height: normal;
}

.cv-bio {
  columns: 2;
  column-gap: 32px;
  white-space: pre-line;
}

.cv-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 24px var(--cv-gutter);
}

.cv-footer {
  display: flex;
  justify-content: center;
  padding-block: 24px;
}

.cv-footer img {
  width: 48px;
}

.cv-errors {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10;
  display: grid;
  gap: 12px;
  max-width: 420px;
}

.cv-error {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 12px 12px 16px;
  border-left: 4px solid var(--cv-red);
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 4px 24px rgb(0 0 0 / 20%);
}

.cv-error p {
  max-height: 40vh;
  overflow: auto;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .cv-bio {
    columns: 1;
  }
}

@media print {
  .cv-errors {
    display: none;
  }

  .cv-body {
    padding-bottom: 0;
  }

  .cv-footer {
    padding-block: 0;
  }
}
</style>
