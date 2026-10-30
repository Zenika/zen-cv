<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import ExperienceCard from './ExperienceCard.vue'
import ExperienceForm from './ExperienceForm.vue'
import type { SaveCv } from '../composables/useCv'
import type { Experience } from '../types'

const props = defineProps<{
  experiences: Experience[]
  editable: boolean
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
  document.querySelectorAll<HTMLElement>('.experience-card')[to]?.focus()
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
  <section class="experience-list">
    <div class="row">
      <h2 class="section-title">Dernières expériences</h2>
      <hr class="divider" />
    </div>

    <ExperienceForm v-if="isAdding" @save="add" @cancel="isAdding = false" />
    <button
      v-else-if="editable"
      type="button"
      class="button experience-list__add"
      @click="isAdding = true"
    >
      Ajouter une expérience
    </button>

    <VueDraggable
      :model-value="experiences"
      :disabled="!editable || edited !== null"
      :animation="200"
      :scroll-sensitivity="120"
      :scroll-speed="25"
      :force-fallback="true"
      filter=".experience-card__actions"
      :prevent-on-filter="false"
      ghost-class="experience-list__placeholder"
      drag-class="experience-list__drag-preview"
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
          v-else-if="editable"
          :experience="experience"
          editable
          class="experience-list__item"
          tabindex="0"
          :aria-label="`${experience.name}, flèches haut et bas pour déplacer`"
          @keydown.self.up.prevent="move(index, -1)"
          @keydown.self.down.prevent="move(index, 1)"
          @edit="edited = experience"
          @delete="askDelete(experience)"
        />
        <ExperienceCard v-else :experience="experience" />
      </template>
    </VueDraggable>

    <dialog ref="deleteDialog" class="dialog" @close="onDeleteDialogClose">
      <form method="dialog" @submit.prevent="remove">
        <p class="dialog__text">
          Supprimer l'expérience <strong>{{ toDelete?.name }}</strong> ?
        </p>
        <p v-if="saveError" class="dialog__text dialog__text--error" role="alert">
          L'enregistrement a échoué : {{ saveError }}
        </p>
        <div class="dialog__actions">
          <button type="button" class="button" autofocus @click="deleteDialog?.close()">
            Annuler
          </button>
          <button class="button button--primary">Supprimer</button>
        </div>
      </form>
    </dialog>
  </section>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.experience-list {
  &__add {
    display: block;
    margin: 0 0 24px auto;
  }

  &__item {
    @media screen {
      cursor: grab;
      user-select: none;
    }
  }

  &__placeholder {
    background: $grey;
    box-shadow: inset 0 0 0 2px $red;

    > * {
      visibility: hidden;
    }
  }

  &__drag-preview {
    cursor: grabbing;
    box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
    /* stylelint-disable-next-line declaration-no-important -- beats the drag library's inline opacity */
    opacity: 1 !important;
  }
}

:root:has(.experience-list__drag-preview) {
  user-select: none;
}

.dialog {
  max-width: 400px;
  padding: 24px;
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgb(0 0 0 / 20%);

  &::backdrop {
    background: rgb(0 0 0 / 40%);
  }

  &__text {
    margin-bottom: 20px;

    &--error {
      color: $red;
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  @media print {
    display: none;
  }
}
</style>
