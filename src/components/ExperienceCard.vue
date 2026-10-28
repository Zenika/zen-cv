<script setup lang="ts">
import type { Experience } from '../types'

defineProps<{ experience: Experience }>()

const emit = defineEmits<{ edit: []; delete: [] }>()
</script>

<template>
  <article class="cv-row cv-card cv-experience">
    <div class="cv-experience-actions">
      <button
        type="button"
        class="cv-icon-button cv-edit"
        :aria-label="`Modifier l'expérience ${experience.name}`"
        @click="emit('edit')"
      >
        ✎
      </button>
      <button
        type="button"
        class="cv-icon-button cv-delete"
        :aria-label="`Supprimer l'expérience ${experience.name}`"
        @click="emit('delete')"
      >
        ×
      </button>
    </div>
    <h3 class="cv-company">{{ experience.name }}</h3>
    <div>
      <p>
        <strong>{{ experience.position }}</strong> ({{ experience.period }})
        <template v-if="'team' in experience"><br />({{ experience.team }})</template>
      </p>

      <h4>Contexte du projet</h4>
      <p>{{ experience.context }}</p>

      <template v-if="experience.realisations.length">
        <h4>Missions & Réalisations</h4>
        <template v-for="(realisation, index) in experience.realisations" :key="index">
          <ul v-if="'title' in realisation" class="cv-bullets">
            <li>
              <strong>{{ realisation.title }} :</strong>
              <ul v-if="Array.isArray(realisation.description)" class="cv-dashes">
                <li v-for="item in realisation.description" :key="item">{{ item }}</li>
              </ul>
              <template v-else>{{ ' ' + realisation.description }}</template>
            </li>
          </ul>
          <ul v-else class="cv-dashes">
            <li v-for="item in realisation.description" :key="item">{{ item }}</li>
          </ul>
        </template>
      </template>

      <p v-if="experience.technicalEnvironment.length === 1" class="cv-tech-inline">
        {{ experience.technicalEnvironment[0]?.name }} :
        {{ experience.technicalEnvironment[0]?.value }}
      </p>
      <template v-else-if="experience.technicalEnvironment.length">
        <h4 class="cv-underline">Environnement technique</h4>
        <p v-for="tech in experience.technicalEnvironment" :key="tech.name" class="cv-tech">
          <strong>{{ tech.name }} :</strong> {{ tech.value }}
        </p>
      </template>
    </div>
  </article>
</template>

<style>
.cv-experience {
  position: relative;
}

.cv-experience p,
.cv-experience ul {
  margin-bottom: 14px;
}

.cv-experience > div > :last-child {
  margin-bottom: 0;
}

.cv-experience h4 {
  font-size: 15px;
}

.cv-experience-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
}

.cv-bullets {
  list-style: disc !important;
  padding-left: 40px !important;
  margin-bottom: 0 !important;
}

.cv-dashes {
  padding-left: 40px !important;
}

.cv-dashes li {
  position: relative;
}

.cv-dashes li::before {
  content: '-';
  position: absolute;
  left: -24px;
}

.cv-bullets .cv-dashes {
  margin-bottom: 0 !important;
}

.cv-tech-inline {
  font-style: italic;
}

.cv-underline {
  font-weight: 400;
  text-decoration: underline;
}

.cv-experience .cv-tech {
  margin-bottom: 0;
}

@media print {
  .cv-experience > div > p:first-child {
    break-after: avoid;
  }
}
</style>
