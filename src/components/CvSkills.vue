<script setup lang="ts">
import type { UserData } from '../types'

defineProps<{ cv: UserData }>()
</script>

<template>
  <div class="skills">
    <div class="skills__grid">
      <section class="card">
        <h2 class="skills__title">Expertises</h2>
        <ul>
          <li v-for="skill in cv.expertise" :key="skill.name">
            {{ skill.name }} : <span class="skills__level">{{ skill.level }}</span>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2 class="skills__title">Méthodologies</h2>
        <ul>
          <li v-for="methodology in cv.methodologies" :key="methodology">
            {{ methodology }}
          </li>
        </ul>
      </section>

      <section class="card">
        <h2 class="skills__title">Formateur</h2>
        <ul>
          <li v-for="training in cv.trainer" :key="training">{{ training }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/variables' as *;

.skills {
  padding: 20px $gutter;
  background: $grey;

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px 32px;
    max-width: $content-width;
    margin: 0 auto;
  }

  &__title {
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 700;
  }

  &__level {
    color: $red;
  }
}
</style>
