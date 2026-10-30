<script setup lang="ts">
import { PencilIcon, XIcon } from '@lucide/vue'
import { onMounted, ref, useTemplateRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import CvExperiences from '../components/CvExperiences.vue'
import CvHeader from '../components/CvHeader.vue'
import CvSkills from '../components/CvSkills.vue'
import InlineEdit from '../components/InlineEdit.vue'
import { useCv } from '../composables/useCv'
import { deleteCv, errorMessage } from '../service/cvApi'

const props = defineProps<{ id: string }>()

const { cv, loadError, load, saveError, save, exportError, isExporting, exportPdf } = useCv(
  props.id,
)

const importWarnings = ref<string[] | null>(history.state?.importWarnings ?? null)

const router = useRouter()
const deleteDialog = useTemplateRef('deleteDialog')
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

async function remove() {
  isDeleting.value = true
  deleteError.value = null
  try {
    await deleteCv(props.id)
    deleteDialog.value?.close()
    await router.push('/')
  } catch (error) {
    deleteError.value = errorMessage(error)
  } finally {
    isDeleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="cv cv-page" v-if="cv">
    <div class="cv-page__actions">
      <button type="button" class="button" @click="deleteDialog?.showModal()">
        Supprimer le CV
      </button>
      <button
        type="button"
        class="button button--primary"
        :disabled="isExporting"
        @click="exportPdf"
      >
        {{ isExporting ? 'Export en cours…' : 'Export PDF' }}
      </button>
    </div>

    <dialog ref="deleteDialog" class="dialog" @close="deleteError = null">
      <form method="dialog" @submit.prevent="remove">
        <p class="dialog__text">
          Supprimer définitivement le CV de
          <strong>{{ cv.firstname }} {{ cv.name }}</strong> ?
        </p>
        <p v-if="deleteError" class="dialog__text dialog__text--error" role="alert">
          La suppression a échoué : {{ deleteError }}
        </p>
        <div class="dialog__actions">
          <button type="button" class="button" autofocus @click="deleteDialog?.close()">
            Annuler
          </button>
          <button class="button button--primary" :disabled="isDeleting">Supprimer</button>
        </div>
      </form>
    </dialog>

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
            <PencilIcon :size="14" />
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

      <section class="row card card--row cv-page__section">
        <h2 class="section-title">Formation</h2>
        <hr class="divider" />
        <div class="row__content">
          <p v-for="education in cv.education" :key="education.title">
            {{ education.period }} <strong>{{ education.title }}</strong
            ><template v-if="education.school">, {{ education.school }}</template
            >.
          </p>
        </div>
      </section>

      <section class="row card card--row cv-page__section">
        <h2 class="section-title">Langues</h2>
        <hr class="divider" />
        <div class="row__content">
          <p>
            <template v-for="(language, index) in cv.languages" :key="language.name">
              <template v-if="index">, </template>
              {{ language.name }}<template v-if="language.level"> ({{ language.level }})</template>
            </template>
          </p>
        </div>
      </section>
    </main>

    <footer class="cv-page__footer">
      <img class="cv-page__logo" src="/images/zenika.png" alt="Zenika" />
    </footer>

    <div class="cv-page__errors">
      <div v-if="importWarnings" class="cv-page__error cv-page__error--notice" role="status">
        <div class="cv-page__error-message">
          <p><strong>CV importé depuis le PDF.</strong> Vérifiez son contenu.</p>
          <ul v-if="importWarnings.length" class="cv-page__warnings">
            <li v-for="warning in importWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="Fermer"
          @click="importWarnings = null"
        >
          <XIcon :size="18" />
        </button>
      </div>
      <div v-if="saveError" class="cv-page__error" role="alert">
        <p class="cv-page__error-message">
          <strong>L'enregistrement a échoué :</strong> {{ saveError }}
        </p>
        <button type="button" class="icon-button" aria-label="Fermer" @click="saveError = null">
          <XIcon :size="18" />
        </button>
      </div>
      <div v-if="exportError" class="cv-page__error" role="alert">
        <p class="cv-page__error-message">
          <strong>L'export PDF a échoué :</strong> {{ exportError }}
        </p>
        <button type="button" class="icon-button" aria-label="Fermer" @click="exportError = null">
          <XIcon :size="18" />
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
  &__actions {
    position: absolute;
    top: 20px;
    right: $gutter;
    display: flex;
    gap: 8px;
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

  &__section {
    @media print {
      break-inside: avoid;
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

  &__error--notice {
    border-left-color: $text;
  }

  &__warnings {
    padding-left: 20px;
    margin-top: 8px;
    list-style: disc;
  }

  &__error-message {
    max-height: 40vh;
    overflow: auto;
    overflow-wrap: anywhere;
  }
}
</style>
