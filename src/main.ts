import { createApp } from 'vue'
import '@fontsource-variable/montserrat'
import '@fontsource-variable/open-sans'
import '@fontsource-variable/open-sans/wght-italic.css'
import './styles/cv.scss'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import CvView from './views/CvView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/cv/:id', component: CvView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

createApp(App).use(router).mount('#app')
