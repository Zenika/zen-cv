<script setup lang="ts">
import { Trash2Icon } from '@lucide/vue'
import { ref } from 'vue'
import type { Experience, Realisation } from '../types'

const props = defineProps<{ experience?: Experience }>()

const emit = defineEmits<{
  save: [experience: Experience]
  cancel: []
}>()

const form = ref(toForm(props.experience))

function toForm(experience?: Experience) {
  if (!experience) {
    return {
      name: '',
      position: '',
      period: '',
      team: '',
      context: '',
      realisations: [{ title: '', items: '' }],
      technicalEnvironment: [{ name: 'Environnement technique', value: '' }],
    }
  }
  return {
    name: experience.name,
    position: experience.position,
    period: experience.period,
    team: experience.team ?? '',
    context: experience.context,
    realisations: experience.realisations.map(({ title, description }) => ({
      title: title ?? '',
      items: Array.isArray(description) ? description.join('\n') : description,
    })),
    technicalEnvironment: experience.technicalEnvironment.map((tech) => ({ ...tech })),
  }
}

function toRealisation({ title, items }: { title: string; items: string }): Realisation {
  const lines = items
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (!title.trim()) return { type: 'list', description: lines }
  if (lines.length === 1) return { title: title.trim(), type: 'text', description: lines[0]! }
  return { title: title.trim(), type: 'list', description: lines }
}

function save() {
  const { team, realisations, technicalEnvironment, ...fields } = form.value
  emit('save', {
    ...fields,
    ...(team && { team }),
    realisations: realisations.filter(({ items }) => items.trim()).map(toRealisation),
    technicalEnvironment: technicalEnvironment
      .filter(({ name, value }) => name.trim() && value.trim())
      .map(({ name, value }) => ({ name: name.trim(), value: value.trim() })),
  })
}
</script>

<template>
  <form class="row card card--row experience-form" @submit.prevent="save">
    <input
      v-model="form.name"
      class="experience-form__input experience-form__company"
      placeholder="Entreprise"
      required
    />
    <div class="experience-form__fields">
      <label class="experience-form__label"
        >Poste <input v-model="form.position" class="experience-form__input" required
      /></label>
      <label class="experience-form__label"
        >Période
        <input
          v-model="form.period"
          class="experience-form__input"
          placeholder="depuis mars 2024"
          required
      /></label>
      <label class="experience-form__label"
        >Équipe
        <input
          v-model="form.team"
          class="experience-form__input"
          placeholder="équipe de 6 personnes"
      /></label>
      <label class="experience-form__label"
        >Contexte du projet
        <textarea v-model="form.context" class="experience-form__input" rows="4" required />
      </label>

      <fieldset class="experience-form__fieldset">
        <legend class="experience-form__legend">Missions & Réalisations</legend>
        <div
          v-for="(realisation, realisationIndex) in form.realisations"
          :key="realisationIndex"
          class="experience-form__group"
        >
          <input
            v-model="realisation.title"
            class="experience-form__input"
            placeholder="Titre (optionnel)"
          />
          <textarea
            v-model="realisation.items"
            class="experience-form__input"
            rows="3"
            placeholder="Un élément par ligne"
          />
          <button
            type="button"
            class="experience-form__small-button"
            aria-label="Supprimer la réalisation"
            @click="form.realisations.splice(realisationIndex, 1)"
          >
            <Trash2Icon :size="16" />
          </button>
        </div>
        <button
          type="button"
          class="experience-form__small-button"
          @click="form.realisations.push({ title: '', items: '' })"
        >
          Ajouter une réalisation
        </button>
      </fieldset>

      <fieldset class="experience-form__fieldset">
        <legend class="experience-form__legend">Environnement technique</legend>
        <div
          v-for="(tech, techIndex) in form.technicalEnvironment"
          :key="techIndex"
          class="experience-form__group"
        >
          <input v-model="tech.name" class="experience-form__input" placeholder="Frontend" />
          <input
            v-model="tech.value"
            class="experience-form__input"
            placeholder="Vue.js, TypeScript"
          />
          <button
            type="button"
            class="experience-form__small-button"
            aria-label="Supprimer l'environnement"
            @click="form.technicalEnvironment.splice(techIndex, 1)"
          >
            <Trash2Icon :size="16" />
          </button>
        </div>
        <button
          type="button"
          class="experience-form__small-button"
          @click="form.technicalEnvironment.push({ name: '', value: '' })"
        >
          Ajouter un environnement
        </button>
      </fieldset>

      <div class="experience-form__actions">
        <button type="button" class="button" @click="emit('cancel')">Annuler</button>
        <button class="button button--primary">Enregistrer</button>
      </div>
    </div>
  </form>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.experience-form {
  &__company {
    color: $red;
    text-align: right;
    text-transform: uppercase;

    @include mobile {
      margin-bottom: 8px;
      text-align: left;
    }
  }

  &__fields {
    display: grid;
    gap: 12px;
  }

  &__label {
    display: grid;
    gap: 4px;
    font-weight: 700;
  }

  &__input {
    padding: 6px 8px;
    font: inherit;
    font-weight: 400;
    border: 1px solid $border;
    border-radius: 4px;
  }

  &__fieldset {
    display: grid;
    gap: 8px;
    padding: 12px;
    margin: 0;
    border: 1px solid $border;
    border-radius: 4px;
  }

  &__legend {
    padding-inline: 4px;
    font-weight: 700;
  }

  &__group {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
    gap: 8px;
    align-items: start;
  }

  &__small-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    justify-self: start;
    padding: 6px 12px;
    font: inherit;
    cursor: pointer;
    background: #fff;
    border: 1px solid $border;
    border-radius: 4px;
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
