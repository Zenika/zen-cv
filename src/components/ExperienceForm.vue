<script setup lang="ts">
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
  <form class="cv-row cv-card cv-experience-form" @submit.prevent="save">
    <input v-model="form.name" class="cv-company" placeholder="Entreprise" required />
    <div>
      <label>Poste <input v-model="form.position" required /></label>
      <label>Période <input v-model="form.period" placeholder="depuis mars 2024" required /></label>
      <label>Équipe <input v-model="form.team" placeholder="équipe de 6 personnes" /></label>
      <label>Contexte du projet <textarea v-model="form.context" rows="4" required /></label>

      <fieldset>
        <legend>Missions & Réalisations</legend>
        <div
          v-for="(realisation, realisationIndex) in form.realisations"
          :key="realisationIndex"
          class="cv-experience-form-group"
        >
          <input v-model="realisation.title" placeholder="Titre (optionnel)" />
          <textarea v-model="realisation.items" rows="3" placeholder="Un élément par ligne" />
          <button
            type="button"
            aria-label="Supprimer la réalisation"
            @click="form.realisations.splice(realisationIndex, 1)"
          >
            ×
          </button>
        </div>
        <button type="button" @click="form.realisations.push({ title: '', items: '' })">
          Ajouter une réalisation
        </button>
      </fieldset>

      <fieldset>
        <legend>Environnement technique</legend>
        <div
          v-for="(tech, techIndex) in form.technicalEnvironment"
          :key="techIndex"
          class="cv-experience-form-group"
        >
          <input v-model="tech.name" placeholder="Frontend" />
          <input v-model="tech.value" placeholder="Vue.js, TypeScript" />
          <button
            type="button"
            aria-label="Supprimer l'environnement"
            @click="form.technicalEnvironment.splice(techIndex, 1)"
          >
            ×
          </button>
        </div>
        <button type="button" @click="form.technicalEnvironment.push({ name: '', value: '' })">
          Ajouter un environnement
        </button>
      </fieldset>

      <div class="cv-experience-form-actions">
        <button type="button" class="cv-button" @click="emit('cancel')">Annuler</button>
        <button class="cv-button cv-button-primary">Enregistrer</button>
      </div>
    </div>
  </form>
</template>

<style>
.cv-experience-form > div {
  display: grid;
  gap: 12px;
}

.cv-experience-form label {
  display: grid;
  gap: 4px;
  font-weight: 700;
}

.cv-experience-form input,
.cv-experience-form textarea,
.cv-experience-form fieldset button {
  font: inherit;
}

.cv-experience-form input,
.cv-experience-form textarea {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-weight: 400;
}

.cv-experience-form fieldset {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.cv-experience-form legend {
  padding-inline: 4px;
  font-weight: 700;
}

.cv-experience-form-group {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 8px;
  align-items: start;
}

.cv-experience-form fieldset button {
  justify-self: start;
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.cv-experience-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media print {
  .cv-experience-form {
    display: none;
  }
}
</style>
