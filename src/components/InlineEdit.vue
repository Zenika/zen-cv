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
    class="inline-edit"
    :class="{ 'inline-edit--multiline': multiline }"
    @submit.prevent="submit"
    @keydown.esc="draft = null"
    @keydown.ctrl.enter.prevent="submit"
    @keydown.meta.enter.prevent="submit"
  >
    <textarea
      v-if="multiline"
      ref="field"
      class="inline-edit__field"
      v-model="draft"
      rows="8"
      :aria-label="label"
      required
    />
    <input
      v-else
      ref="field"
      class="inline-edit__field"
      v-model="draft"
      :aria-label="label"
      required
    />
    <div class="inline-edit__actions">
      <button type="button" class="button" @click="draft = null">Annuler</button>
      <button class="button button--primary">Enregistrer</button>
    </div>
  </form>
  <slot v-else :edit="edit" />
</template>

<style lang="scss">
@use '@/styles/variables' as *;
.inline-edit {
  display: flex;
  align-items: center;
  gap: 8px;

  &__field {
    flex: 0 1 360px;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid $border;
    border-radius: 4px;
    color: inherit;
    font: inherit;
  }

  &__actions {
    display: flex;
    gap: 8px;
    font-family: $font-body;
    font-size: 15px;
  }

  &--multiline {
    display: grid;
    gap: 12px;

    .inline-edit__field {
      padding: 8px;
      resize: vertical;
    }

    .inline-edit__actions {
      justify-content: flex-end;
    }
  }
}
</style>
