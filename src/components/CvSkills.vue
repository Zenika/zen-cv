<script setup lang="ts">
import type { UserData } from '../types'

defineProps<{ cv: UserData }>()
</script>

<template>
  <div class="cv-band">
    <div class="cv-skills">
      <section class="cv-card">
        <h2>Expertises</h2>
        <ul>
          <li v-for="skill in cv.expertise" :key="skill.name">
            {{ skill.name }} : <span class="cv-accent">{{ skill.level }}</span>
          </li>
        </ul>
      </section>

      <section class="cv-card">
        <h2>Méthodologies</h2>
        <ul>
          <li v-for="methodology in cv.methodologies" :key="methodology">
            {{ methodology }}
          </li>
        </ul>
      </section>

      <section class="cv-card">
        <h2>Formateur</h2>
        <ul>
          <li v-for="training in cv.trainer" :key="training">{{ training }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style>
.cv-band {
  padding: 20px var(--cv-gutter);
  background: var(--cv-grey);
}

.cv-skills {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px 32px;
  max-width: 860px;
  margin: 0 auto;
}

.cv-skills h2 {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 12px;
}
</style>
