<script setup lang="ts">
import { PencilIcon, PlusIcon } from '@lucide/vue'
import { ref, useTemplateRef } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import InlineEdit from './InlineEdit.vue'
import type { CvVersion } from '../types'

const props = defineProps<{
  versions: CvVersion[]
  currentId: string
  editable: boolean
  error: string | null
  create: (label: string) => Promise<string | null>
  rename: (label: string) => Promise<boolean>
}>()

const router = useRouter()
const dialog = useTemplateRef('dialog')
const label = ref('')
const isCreating = ref(false)

function open() {
  label.value = ''
  dialog.value?.showModal()
}

async function submit() {
  isCreating.value = true
  const id = await props.create(label.value.trim())
  isCreating.value = false
  if (!id) return
  dialog.value?.close()
  await router.push(`/cv/${encodeURIComponent(id)}`)
}
</script>

<template>
  <nav v-if="versions.length > 1 || editable" class="cv-versions" aria-label="Versions du CV">
    <ul class="cv-versions__list">
      <li v-for="version in versions" :key="version.id">
        <span
          v-if="version.id === currentId"
          class="cv-versions__item cv-versions__item--current"
          aria-current="page"
        >
          <InlineEdit
            v-if="version.label !== null && editable"
            :value="version.label"
            label="Label de la version"
            :save="rename"
            v-slot="{ edit }"
          >
            {{ version.label }}
            <button
              type="button"
              class="icon-button icon-button--small cv-versions__rename"
              aria-label="Renommer la version"
              @click="edit"
            >
              <PencilIcon :size="12" />
            </button>
          </InlineEdit>
          <template v-else>{{ version.label ?? 'CV principal' }}</template>
        </span>
        <RouterLink v-else :to="`/cv/${encodeURIComponent(version.id)}`" class="cv-versions__item">
          {{ version.label ?? 'CV principal' }}
        </RouterLink>
      </li>
    </ul>
    <button v-if="editable" type="button" class="button cv-versions__add" @click="open">
      <PlusIcon :size="14" /> Nouvelle version
    </button>

    <dialog v-if="editable" ref="dialog" class="dialog">
      <form method="dialog" @submit.prevent="submit">
        <label class="dialog__text cv-versions__field">
          Label de la nouvelle version, copie de «
          {{ versions.find((version) => version.id === currentId)?.label ?? 'CV principal' }} »
          (n'apparaît pas sur le PDF)
          <input v-model="label" class="cv-versions__input" maxlength="100" required />
        </label>
        <p v-if="error" class="dialog__text dialog__text--error" role="alert">
          La création a échoué : {{ error }}
        </p>
        <div class="dialog__actions">
          <button type="button" class="button" @click="dialog?.close()">Annuler</button>
          <button class="button button--primary" :disabled="isCreating">Créer</button>
        </div>
      </form>
    </dialog>
  </nav>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.cv-versions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  max-width: $content-width;
  padding: 0 $gutter 16px;
  margin: 0 auto;

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__item {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    font-size: 14px;
    color: $text;
    text-decoration: none;
    border: 1px solid $border;
    border-radius: 16px;

    &:hover {
      border-color: $red;
    }

    &--current {
      font-weight: 600;
      color: #fff;
      background: $red;
      border-color: $red;

      .inline-edit__field {
        color: $text;
      }
    }
  }

  &__rename {
    color: inherit;
  }

  &__add {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 4px 12px;
    font-size: 14px;
  }

  &__field {
    display: grid;
    gap: 8px;
  }

  &__input {
    padding: 8px 12px;
    font: inherit;
    border: 1px solid $border;
    border-radius: 4px;
  }

  @media print {
    display: none;
  }
}
</style>
