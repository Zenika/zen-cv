<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'

const props = defineProps<{
  value: string
  label: string
  multiline?: boolean
  save: (value: string) => Promise<boolean>
}>()

const draft = ref<string | null>(null)
const field = useTemplateRef<HTMLInputElement | HTMLTextAreaElement>('field')

async function edit() {
  draft.value = props.value
  await nextTick()
  if (props.multiline) field.value?.focus()
  else field.value?.select()
}

async function submit() {
  if (draft.value === null) return
  if (await props.save(draft.value.trim())) draft.value = null
}
</script>

<template>
  <form
    v-if="draft !== null"
    class="cv-inline-edit"
    :class="{ 'cv-inline-edit-multiline': multiline }"
    @submit.prevent="submit"
    @keydown.esc="draft = null"
    @keydown.ctrl.enter.prevent="submit"
    @keydown.meta.enter.prevent="submit"
  >
    <textarea v-if="multiline" ref="field" v-model="draft" rows="8" :aria-label="label" required />
    <input v-else ref="field" v-model="draft" :aria-label="label" required />
    <div class="cv-inline-edit-actions">
      <button type="button" class="cv-button" @click="draft = null">Annuler</button>
      <button class="cv-button cv-button-primary">Enregistrer</button>
    </div>
  </form>
  <slot v-else :edit="edit" />
</template>

<style>
.cv-inline-edit {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cv-inline-edit input,
.cv-inline-edit textarea {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: inherit;
  font: inherit;
}

.cv-inline-edit input {
  flex: 0 1 360px;
  min-width: 0;
}

.cv-inline-edit-actions {
  display: flex;
  gap: 8px;
}

.cv-inline-edit-multiline {
  display: grid;
  gap: 12px;
}

.cv-inline-edit-multiline textarea {
  padding: 8px;
  resize: vertical;
}

.cv-inline-edit-multiline .cv-inline-edit-actions {
  justify-content: flex-end;
}
</style>
