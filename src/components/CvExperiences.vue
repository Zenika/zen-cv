<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import ExperienceCard from './ExperienceCard.vue'
import ExperienceForm from './ExperienceForm.vue'
import type { SaveCv } from '../composables/useCv'
import type { Experience } from '../types'

const props = defineProps<{
  experiences: Experience[]
  save: SaveCv
  saveError: string | null
}>()

const emit = defineEmits<{ clearSaveError: [] }>()

const isAdding = ref(false)

async function add(experience: Experience) {
  if (await props.save({ experiences: [experience, ...props.experiences] })) isAdding.value = false
}

const edited = ref<Experience | null>(null)

async function update(experience: Experience) {
  const experiences = props.experiences.map((item) => (item === edited.value ? experience : item))
  if (await props.save({ experiences })) edited.value = null
}

function reorder(experiences: Experience[]) {
  return props.save({ experiences }, { optimistic: true })
}

async function move(index: number, offset: -1 | 1) {
  const to = index + offset
  if (to < 0 || to >= props.experiences.length) return
  const experiences = [...props.experiences]
  const [experience] = experiences.splice(index, 1)
  experiences.splice(to, 0, experience!)
  await reorder(experiences)
  await nextTick()
  document.querySelectorAll<HTMLElement>('.cv-experience')[to]?.focus()
}

const deleteDialog = useTemplateRef('deleteDialog')
const toDelete = ref<Experience | null>(null)

function askDelete(experience: Experience) {
  toDelete.value = experience
  deleteDialog.value?.showModal()
}

function onDeleteDialogClose() {
  toDelete.value = null
  emit('clearSaveError')
}

async function remove() {
  const experience = toDelete.value
  if (!experience) return
  const experiences = props.experiences.filter((item) => item !== experience)
  if (await props.save({ experiences })) deleteDialog.value?.close()
}
</script>

<template>
  <section>
    <div class="cv-row">
      <h2 class="cv-section-title">Dernières expériences</h2>
      <hr />
    </div>

    <ExperienceForm v-if="isAdding" @save="add" @cancel="isAdding = false" />
    <button v-else type="button" class="cv-button cv-add" @click="isAdding = true">
      Ajouter une expérience
    </button>

    <VueDraggable
      :model-value="experiences"
      :disabled="edited !== null"
      :animation="200"
      :scroll-sensitivity="120"
      :scroll-speed="25"
      :force-fallback="true"
      filter=".cv-experience-actions"
      :prevent-on-filter="false"
      ghost-class="cv-drag-placeholder"
      drag-class="cv-drag-preview"
      @update:model-value="reorder"
    >
      <template v-for="(experience, index) in experiences" :key="index">
        <ExperienceForm
          v-if="experience === edited"
          :experience="experience"
          @save="update"
          @cancel="edited = null"
        />
        <ExperienceCard
          v-else
          :experience="experience"
          tabindex="0"
          :aria-label="`${experience.name}, flèches haut et bas pour déplacer`"
          @keydown.self.up.prevent="move(index, -1)"
          @keydown.self.down.prevent="move(index, 1)"
          @edit="edited = experience"
          @delete="askDelete(experience)"
        />
      </template>
    </VueDraggable>

    <dialog ref="deleteDialog" class="cv-dialog" @close="onDeleteDialogClose">
      <form method="dialog" @submit.prevent="remove">
        <p>
          Supprimer l'expérience <strong>{{ toDelete?.name }}</strong> ?
        </p>
        <p v-if="saveError" class="cv-dialog-error" role="alert">
          L'enregistrement a échoué : {{ saveError }}
        </p>
        <div class="cv-dialog-actions">
          <button type="button" class="cv-button" autofocus @click="deleteDialog?.close()">
            Annuler
          </button>
          <button class="cv-button cv-button-primary">Supprimer</button>
        </div>
      </form>
    </dialog>
  </section>
</template>

<style>
.cv-add {
  display: block;
  margin: 0 0 24px auto;
}

@media screen {
  .cv-experience {
    cursor: grab;
    user-select: none;
  }

  .cv:has(.cv-drag-preview) {
    user-select: none;
  }
}

.cv-drag-placeholder {
  background: var(--cv-grey);
  box-shadow: inset 0 0 0 2px var(--cv-red);
}

.cv-drag-placeholder > * {
  visibility: hidden;
}

.cv-drag-preview {
  opacity: 1 !important;
  box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
  cursor: grabbing;
}

.cv-dialog {
  max-width: 400px;
  padding: 24px;
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgb(0 0 0 / 20%);
}

.cv-dialog::backdrop {
  background: rgb(0 0 0 / 40%);
}

.cv-dialog p {
  margin-bottom: 20px;
}

.cv-dialog .cv-dialog-error {
  color: var(--cv-red);
}

.cv-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media print {
  .cv-dialog {
    display: none;
  }
}
</style>
