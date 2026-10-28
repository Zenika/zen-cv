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
  <div class="cv cv-page" v-if="cv">
    <button
      type="button"
      class="button button--primary cv-page__export"
      :disabled="isExporting"
      @click="exportPdf"
    >
      {{ isExporting ? 'Export en cours…' : 'Export PDF' }}
    </button>

    <CvHeader :cv="cv" :save="save" />

    <div class="cv-page__intro">
      <div class="card cv-page__bio">
        <InlineEdit
          :value="cv.bio"
          label="Bio"
          multiline
          :save="(bio) => save({ bio })"
          v-slot="{ edit }"
        >
          <button
            type="button"
            class="icon-button icon-button--small cv-page__bio-edit"
            aria-label="Modifier la bio"
            @click="edit"
          >
            ✎
          </button>
          <p class="cv-page__bio-text">{{ cv.bio }}</p>
        </InlineEdit>
      </div>
    </div>

    <CvSkills :cv="cv" />

    <main class="cv-page__body">
      <CvExperiences
        :experiences="cv.experiences"
        :save="save"
        :save-error="saveError"
        @clear-save-error="saveError = null"
      />

      <section class="row card card--row">
        <h2 class="section-title">Formation</h2>
        <div>
          <hr class="divider" />
          <p v-for="education in cv.education" :key="education.title">
            {{ education.period }} <strong>{{ education.title }}</strong
            >, {{ education.school }}.
          </p>
        </div>
      </section>

      <section class="row card card--row">
        <h2 class="section-title">Langues</h2>
        <div>
          <hr class="divider" />
          <p>
            <template v-for="(language, index) in cv.languages" :key="language.name">
              <template v-if="index">, </template>
              {{ language.name }} ({{ language.level }})
            </template>
          </p>
        </div>
      </section>
    </main>

    <footer class="cv-page__footer">
      <img class="cv-page__logo" src="/images/zenika.png" alt="Zenika" />
    </footer>

    <div class="cv-page__errors">
      <div v-if="saveError" class="cv-page__error" role="alert">
        <p class="cv-page__error-message">
          <strong>L'enregistrement a échoué :</strong> {{ saveError }}
        </p>
        <button type="button" class="icon-button" aria-label="Fermer" @click="saveError = null">
          ×
        </button>
      </div>
      <div v-if="exportError" class="cv-page__error" role="alert">
        <p class="cv-page__error-message">
          <strong>L'export PDF a échoué :</strong> {{ exportError }}
        </p>
        <button type="button" class="icon-button" aria-label="Fermer" @click="exportError = null">
          ×
        </button>
      </div>
    </div>
  </div>
  <div v-else-if="loadError" class="cv" role="alert">
    <div class="load-error">
      <RouterLink to="/" class="back-link">← Tous les CV</RouterLink>
      <p class="load-error__message">
        <strong>Le CV n'a pas pu être chargé :</strong> {{ loadError }}
      </p>
      <button type="button" class="button button--primary load-error__retry" @click="load">
        Réessayer
      </button>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.cv-page {
  &__export {
    position: absolute;
    top: 20px;
    right: $gutter;
  }

  &__intro {
    max-width: $content-width;
    padding: 0 $gutter 20px;
    margin: 0 auto;
  }

  &__bio {
    position: relative;
  }

  &__bio-edit {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  &__bio-text {
    columns: 2;
    column-gap: 32px;
    white-space: pre-line;

    @include mobile {
      columns: 1;
    }
  }

  &__body {
    max-width: $content-width;
    padding: 24px $gutter;
    margin: 0 auto;

    @media print {
      padding-bottom: 0;
    }
  }

  &__footer {
    display: flex;
    justify-content: center;
    padding-block: 24px;

    @media print {
      padding-block: 0;
    }
  }

  &__logo {
    width: 48px;
  }

  &__errors {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 10;
    display: grid;
    gap: 12px;
    max-width: 420px;

    @media print {
      display: none;
    }
  }

  &__error {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 12px 12px 16px;
    background: #fff;
    border-left: 4px solid $red;
    border-radius: 4px;
    box-shadow: 0 4px 24px rgb(0 0 0 / 20%);
  }

  &__error-message {
    max-height: 40vh;
    overflow: auto;
    overflow-wrap: anywhere;
  }
}
</style>
