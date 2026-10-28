<script setup lang="ts">
import type { Experience } from '../types'

defineProps<{ experience: Experience }>()

const emit = defineEmits<{ edit: []; delete: [] }>()
</script>

<template>
  <article class="row card card--row experience-card">
    <div class="experience-card__actions">
      <button
        type="button"
        class="icon-button experience-card__edit"
        :aria-label="`Modifier l'expérience ${experience.name}`"
        @click="emit('edit')"
      >
        ✎
      </button>
      <button
        type="button"
        class="icon-button experience-card__delete"
        :aria-label="`Supprimer l'expérience ${experience.name}`"
        @click="emit('delete')"
      >
        ×
      </button>
    </div>
    <h3 class="experience-card__company">{{ experience.name }}</h3>
    <div class="experience-card__content">
      <p class="experience-card__role">
        <strong>{{ experience.position }}</strong> ({{ experience.period }})
        <template v-if="'team' in experience"><br />({{ experience.team }})</template>
      </p>

      <h4 class="experience-card__heading">Contexte du projet</h4>
      <p class="experience-card__text">{{ experience.context }}</p>

      <template v-if="experience.realisations.length">
        <h4 class="experience-card__heading">Missions & Réalisations</h4>
        <template v-for="(realisation, index) in experience.realisations" :key="index">
          <ul
            v-if="'title' in realisation"
            class="experience-card__list experience-card__list--bullets"
          >
            <li>
              <strong>{{ realisation.title }} :</strong>
              <ul
                v-if="Array.isArray(realisation.description)"
                class="experience-card__list experience-card__list--dashes experience-card__list--nested"
              >
                <li
                  v-for="item in realisation.description"
                  :key="item"
                  class="experience-card__dash"
                >
                  {{ item }}
                </li>
              </ul>
              <template v-else>{{ ' ' + realisation.description }}</template>
            </li>
          </ul>
          <ul v-else class="experience-card__list experience-card__list--dashes">
            <li v-for="item in realisation.description" :key="item" class="experience-card__dash">
              {{ item }}
            </li>
          </ul>
        </template>
      </template>

      <p
        v-if="experience.technicalEnvironment.length === 1"
        class="experience-card__tech experience-card__tech--inline"
      >
        {{ experience.technicalEnvironment[0]?.name }} :
        {{ experience.technicalEnvironment[0]?.value }}
      </p>
      <template v-else-if="experience.technicalEnvironment.length">
        <h4 class="experience-card__heading experience-card__heading--underlined">
          Environnement technique
        </h4>
        <p
          v-for="tech in experience.technicalEnvironment"
          :key="tech.name"
          class="experience-card__tech"
        >
          <strong>{{ tech.name }} :</strong> {{ tech.value }}
        </p>
      </template>
    </div>
  </article>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.experience-card {
  position: relative;

  &__actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 2px;
  }

  &__company {
    font-family: $font-heading;
    font-size: 16px;
    font-weight: 400;
    color: $red;
    text-align: right;
    text-transform: uppercase;

    @include mobile {
      text-align: left;
    }
  }

  &__role,
  &__text {
    margin-bottom: 14px;
  }

  &__role {
    @media print {
      break-after: avoid;
    }
  }

  &__heading {
    font-size: 15px;

    &--underlined {
      font-weight: 400;
      text-decoration: underline;
    }

    @media print {
      break-after: avoid;
    }
  }

  &__list {
    padding-left: 40px;

    &--bullets {
      margin-bottom: 0;
      list-style: disc;
    }

    &--dashes {
      margin-bottom: 14px;
    }

    &--nested {
      margin-bottom: 0;
    }
  }

  &__dash {
    position: relative;

    &::before {
      position: absolute;
      left: -24px;
      content: '-';
    }
  }

  &__tech {
    margin-bottom: 0;

    &--inline {
      margin-bottom: 14px;
      font-style: italic;
    }
  }

  &__content > :last-child {
    margin-bottom: 0;
  }
}
</style>
