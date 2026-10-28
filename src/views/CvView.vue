<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { RouterLink } from 'vue-router'
import ExperienceForm from '../components/ExperienceForm.vue'
import type { Experience, UserData } from '../types'

const props = defineProps<{ id: string }>()

const userData = ref<UserData | null>(null)

const loadError = ref<string | null>(null)

async function loadUserData() {
  loadError.value = null
  let response: Response
  try {
    response = await fetch(`/api/cvs/${encodeURIComponent(props.id)}`)
  } catch {
    loadError.value = 'le serveur est injoignable.'
    return
  }
  if (!response.ok) {
    loadError.value = (await response.text()) || `erreur ${response.status}.`
    return
  }
  try {
    userData.value = await response.json()
  } catch {
    loadError.value = 'les données reçues ne sont pas un JSON valide.'
  }
}

const saveError = ref<string | null>(null)

async function saveUserData(data: UserData) {
  let response: Response
  try {
    response = await fetch(`/api/cvs/${encodeURIComponent(props.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch {
    saveError.value = 'le serveur est injoignable.'
    return false
  }
  if (!response.ok) {
    saveError.value = (await response.text()) || `erreur ${response.status}.`
    return false
  }
  saveError.value = null
  userData.value = data
  return true
}

const exportError = ref<string | null>(null)
const isExporting = ref(false)

async function exportPdf() {
  isExporting.value = true
  exportError.value = null
  try {
    let response: Response
    try {
      response = await fetch(`/api/cvs/${encodeURIComponent(props.id)}/pdf`)
    } catch {
      exportError.value = 'le serveur est injoignable.'
      return
    }
    if (!response.ok) {
      exportError.value = (await response.text()) || `erreur ${response.status}.`
      return
    }
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = `cv-${props.id}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  } finally {
    isExporting.value = false
  }
}

const isAddingExperience = ref(false)

async function addExperience(experience: Experience) {
  if (!userData.value) return
  const added = await saveUserData({
    ...userData.value,
    experiences: [experience, ...userData.value.experiences],
  })
  if (added) isAddingExperience.value = false
}

const editedExperience = ref<Experience | null>(null)

async function updateExperience(experience: Experience) {
  if (!userData.value) return
  const updated = await saveUserData({
    ...userData.value,
    experiences: userData.value.experiences.map((item) =>
      item === editedExperience.value ? experience : item,
    ),
  })
  if (updated) editedExperience.value = null
}

async function reorderExperiences(experiences: Experience[]) {
  if (!userData.value) return
  const previous = userData.value
  userData.value = { ...previous, experiences }
  if (!(await saveUserData(userData.value))) userData.value = previous
}

async function moveExperience(index: number, offset: -1 | 1) {
  if (!userData.value) return
  const to = index + offset
  if (to < 0 || to >= userData.value.experiences.length) return
  const experiences = [...userData.value.experiences]
  const [experience] = experiences.splice(index, 1)
  experiences.splice(to, 0, experience!)
  await reorderExperiences(experiences)
  await nextTick()
  document.querySelectorAll<HTMLElement>('.cv-experience')[to]?.focus()
}

const deleteDialog = useTemplateRef('deleteDialog')
const experienceToDelete = ref<Experience | null>(null)

function askDeleteExperience(experience: Experience) {
  experienceToDelete.value = experience
  deleteDialog.value?.showModal()
}

function onDeleteDialogClose() {
  experienceToDelete.value = null
  saveError.value = null
}

async function deleteExperience() {
  const experience = experienceToDelete.value
  if (!userData.value || !experience) return
  const deleted = await saveUserData({
    ...userData.value,
    experiences: userData.value.experiences.filter((item) => item !== experience),
  })
  if (deleted) deleteDialog.value?.close()
}

onMounted(loadUserData)
</script>

<template>
  <div class="cv" v-if="userData">
    <button type="button" class="cv-export" :disabled="isExporting" @click="exportPdf">
      {{ isExporting ? 'Export en cours…' : 'Export PDF' }}
    </button>
    <header class="cv-header">
      <div>
        <RouterLink to="/" class="cv-back">← Tous les CV</RouterLink>
        <h1>
          {{ userData.firstname }}
          <span class="cv-lastname">{{ userData.name }}</span>
        </h1>
        <p class="cv-title">{{ userData.title }}</p>
        <ul class="cv-links">
          <template v-for="links in userData.links">
            <li v-for="(url, name) in links" :key="name">
              <a :href="url">{{ name }}</a>
            </li>
          </template>
        </ul>
      </div>
    </header>

    <div class="cv-intro">
      <p class="cv-bio cv-card">{{ userData.bio }}</p>
    </div>

    <div class="cv-band">
      <div class="cv-skills">
        <section class="cv-card">
          <h2>Expertises</h2>
          <ul>
            <li v-for="skill in userData.expertise" :key="skill.name">
              {{ skill.name }} : <span class="cv-accent">{{ skill.level }}</span>
            </li>
          </ul>
        </section>

        <section class="cv-card">
          <h2>Méthodologies</h2>
          <ul>
            <li v-for="methodology in userData.methodologies" :key="methodology">
              {{ methodology }}
            </li>
          </ul>
        </section>

        <section class="cv-card">
          <h2>Formateur</h2>
          <ul>
            <li v-for="training in userData.trainer" :key="training">{{ training }}</li>
          </ul>
        </section>
      </div>
    </div>

    <main class="cv-body">
      <section>
        <div class="cv-row">
          <h2 class="cv-section-title">Dernières expériences</h2>
          <hr />
        </div>

        <ExperienceForm
          v-if="isAddingExperience"
          @save="addExperience"
          @cancel="isAddingExperience = false"
        />
        <button v-else type="button" class="cv-add" @click="isAddingExperience = true">
          Ajouter une expérience
        </button>

        <VueDraggable
          :model-value="userData.experiences"
          :disabled="editedExperience !== null"
          :animation="200"
          :scroll-sensitivity="120"
          :scroll-speed="25"
          :force-fallback="true"
          filter=".cv-experience-actions"
          :prevent-on-filter="false"
          ghost-class="cv-drag-placeholder"
          drag-class="cv-drag-preview"
          @update:model-value="reorderExperiences"
        >
          <template
            v-for="(experience, experienceIndex) in userData.experiences"
            :key="experienceIndex"
          >
            <ExperienceForm
              v-if="experience === editedExperience"
              :experience="experience"
              @save="updateExperience"
              @cancel="editedExperience = null"
            />
            <article
              v-else
              class="cv-row cv-card cv-experience"
              tabindex="0"
              :aria-label="`${experience.name}, flèches haut et bas pour déplacer`"
              @keydown.self.up.prevent="moveExperience(experienceIndex, -1)"
              @keydown.self.down.prevent="moveExperience(experienceIndex, 1)"
            >
              <div class="cv-experience-actions">
                <button
                  type="button"
                  class="cv-edit"
                  :aria-label="`Modifier l'expérience ${experience.name}`"
                  @click="editedExperience = experience"
                >
                  ✎
                </button>
                <button
                  type="button"
                  class="cv-delete"
                  :aria-label="`Supprimer l'expérience ${experience.name}`"
                  @click="askDeleteExperience(experience)"
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
                  <p
                    v-for="tech in experience.technicalEnvironment"
                    :key="tech.name"
                    class="cv-tech"
                  >
                    <strong>{{ tech.name }} :</strong> {{ tech.value }}
                  </p>
                </template>
              </div>
            </article>
          </template>
        </VueDraggable>
      </section>

      <section class="cv-row cv-card">
        <h2 class="cv-section-title">Formation</h2>
        <div>
          <hr />
          <p v-for="education in userData.education" :key="education.title">
            {{ education.period }} <strong>{{ education.title }}</strong
            >, {{ education.school }}.
          </p>
        </div>
      </section>

      <section class="cv-row cv-card">
        <h2 class="cv-section-title">Langues</h2>
        <div>
          <hr />
          <p>
            <template v-for="(language, index) in userData.languages" :key="language.name">
              <template v-if="index">, </template>
              {{ language.name }} ({{ language.level }})
            </template>
          </p>
        </div>
      </section>
    </main>

    <footer class="cv-footer">
      <img src="/images/zenika.png" alt="Zenika" />
    </footer>

    <div class="cv-errors">
      <div v-if="saveError" class="cv-error" role="alert">
        <p><strong>L'enregistrement a échoué :</strong> {{ saveError }}</p>
        <button type="button" aria-label="Fermer" @click="saveError = null">×</button>
      </div>
      <div v-if="exportError" class="cv-error" role="alert">
        <p><strong>L'export PDF a échoué :</strong> {{ exportError }}</p>
        <button type="button" aria-label="Fermer" @click="exportError = null">×</button>
      </div>
    </div>

    <dialog ref="deleteDialog" class="cv-dialog" @close="onDeleteDialogClose">
      <form method="dialog" @submit.prevent="deleteExperience">
        <p>
          Supprimer l'expérience <strong>{{ experienceToDelete?.name }}</strong> ?
        </p>
        <p v-if="saveError" class="cv-dialog-error" role="alert">
          L'enregistrement a échoué : {{ saveError }}
        </p>
        <div class="cv-dialog-actions">
          <button type="button" autofocus @click="deleteDialog?.close()">Annuler</button>
          <button>Supprimer</button>
        </div>
      </form>
    </dialog>
  </div>
  <div v-else-if="loadError" class="cv" role="alert">
    <div class="cv-load-error">
      <RouterLink to="/" class="cv-back">← Tous les CV</RouterLink>
      <p><strong>Le CV n'a pas pu être chargé :</strong> {{ loadError }}</p>
      <button type="button" @click="loadUserData">Réessayer</button>
    </div>
  </div>
</template>

<style>
.cv {
  --cv-red: #ee2238;
  --cv-grey: #f3f3f3;
  --cv-text: #111;
  --cv-gutter: 24px;

  font-family: 'Open Sans', sans-serif;
  font-size: 15px;
  line-height: 1.45;
  color: var(--cv-text);
  border-top: 10px solid var(--cv-red);
}

.cv h1,
.cv-section-title,
.cv-company {
  font-family: 'Montserrat', sans-serif;
  font-weight: 400;
}

.cv h1,
.cv h2,
.cv h3,
.cv h4,
.cv p,
.cv ul {
  margin: 0;
}

.cv ul {
  padding: 0;
  list-style: none;
}

.cv-accent,
.cv-lastname,
.cv-company {
  color: var(--cv-red);
}

/* Header */
.cv-header,
.cv-intro,
.cv-band,
.cv-body {
  padding-inline: var(--cv-gutter);
}

.cv-header {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  max-width: 860px;
  margin: 0 auto;
  padding-block: 20px;
}

.cv h1 {
  font-size: 32px;
  line-height: 1.1;
}

.cv-lastname {
  display: block;
  text-transform: uppercase;
}

.cv-title {
  font-family: 'Montserrat', sans-serif;
  font-size: 18px;
  margin-top: 6px !important;
}

.cv-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px !important;
  font-size: 13px;
}

.cv-links a {
  color: var(--cv-red);
}

.cv-band {
  background: var(--cv-grey);
  padding-block: 20px;
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

.cv-body {
  max-width: 860px;
  margin: 0 auto;
  padding-block: 24px;
}

.cv-intro {
  max-width: 860px;
  margin: 0 auto;
  padding-bottom: 20px;
}

.cv-bio {
  columns: 2;
  column-gap: 32px;
}

.cv-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 0 24px;
  align-items: start;
  margin-bottom: 32px;
}

.cv hr {
  align-self: center;
  border: none;
  border-top: 1px solid var(--cv-red);
  margin: 0 0 16px;
}

.cv-row > hr {
  margin: 0;
}

.cv-section-title {
  font-size: 28px;
  line-height: 1.15;
  text-align: right;
  text-transform: uppercase;
}

.cv-company {
  font-size: 16px;
  text-align: right;
  text-transform: uppercase;
}

.cv-card {
  padding: 20px 24px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.cv-row.cv-card {
  padding-left: 0;
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

.cv-footer {
  display: flex;
  justify-content: center;
  padding-block: 24px;
}

.cv-footer img {
  width: 48px;
}

@media (max-width: 640px) {
  .cv-row {
    grid-template-columns: 1fr;
  }

  .cv-section-title,
  .cv-company {
    text-align: left;
  }

  .cv-section-title {
    font-size: 22px;
  }

  .cv-company {
    margin-bottom: 8px;
  }

  .cv-card,
  .cv-row.cv-card {
    padding: 16px;
  }

  .cv-bio {
    columns: 1;
  }
}

.cv {
  position: relative;
}

.cv-export {
  position: absolute;
  top: 20px;
  right: var(--cv-gutter);
  padding: 8px 16px;
  border-radius: 4px;
  background: var(--cv-red);
  color: #fff;
  border: none;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.cv-back {
  display: inline-block;
  margin-bottom: 12px;
  color: #666;
  font-size: 13px;
  text-decoration: none;
}

.cv-back:hover {
  color: var(--cv-red);
}

.cv-export:disabled {
  opacity: 0.7;
  cursor: progress;
}

.cv-add {
  display: block;
  margin: 0 0 24px auto;
  padding: 8px 16px;
  border: 1px solid var(--cv-red);
  border-radius: 4px;
  background: #fff;
  color: var(--cv-red);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.cv-experience {
  position: relative;
}

.cv-experience-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
}

.cv-experience-actions button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: #666;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.cv-experience-actions button:hover {
  background: var(--cv-grey);
}

@media screen {
  .cv-experience {
    cursor: grab;
    user-select: none;
  }

  .cv:has(.cv-drag-preview) {
    user-select: none;
  }
}

.cv-drag-placeholder {
  background: var(--cv-grey);
  box-shadow: inset 0 0 0 2px var(--cv-red);
}

.cv-drag-placeholder > * {
  visibility: hidden;
}

.cv-drag-preview {
  opacity: 1 !important;
  box-shadow: 0 12px 32px rgb(0 0 0 / 25%);
  cursor: grabbing;
}

.cv-dialog {
  max-width: 400px;
  padding: 24px;
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgb(0 0 0 / 20%);
}

.cv-dialog::backdrop {
  background: rgb(0 0 0 / 40%);
}

.cv-dialog p {
  margin-bottom: 20px;
}

.cv-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cv-dialog-actions button {
  padding: 8px 16px;
  border: 1px solid var(--cv-red);
  border-radius: 4px;
  background: #fff;
  color: var(--cv-red);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.cv-dialog-actions button:last-child {
  background: var(--cv-red);
  color: #fff;
}

.cv-dialog .cv-dialog-error {
  color: var(--cv-red);
}

.cv-load-error {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px var(--cv-gutter);
}

.cv-load-error button {
  margin-top: 16px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: var(--cv-red);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.cv-errors {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10;
  display: grid;
  gap: 12px;
  max-width: 420px;
}

.cv-error {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 12px 12px 16px;
  border-left: 4px solid var(--cv-red);
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 4px 24px rgb(0 0 0 / 20%);
}

.cv-error p {
  max-height: 40vh;
  overflow: auto;
  overflow-wrap: anywhere;
}

.cv-error button {
  padding: 0;
  border: none;
  background: none;
  color: #666;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

@page {
  size: A4;
  margin: 12mm 0 20mm;
}

@page :first {
  margin-top: 0;
}

@media print {
  .cv-back,
  .cv-export,
  .cv-add,
  .cv-experience-actions,
  .cv-dialog,
  .cv-errors {
    display: none;
  }

  .cv p,
  .cv li {
    break-inside: avoid;
  }

  .cv-body {
    padding-bottom: 0;
  }

  .cv-footer {
    padding-block: 0;
  }

  .cv-card,
  .cv-row.cv-card {
    padding: 0;
    background: none;
    box-shadow: none;
  }

  .cv h4,
  .cv-section-title,
  .cv-experience > div > p:first-child {
    break-after: avoid;
  }
}
</style>
