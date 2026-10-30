import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { getCvs, importCvPdf } from '../../service/cvApi'
import type { CurrentUser, CvSummary } from '../../types'
import HomeView from '../HomeView.vue'

const user = ref<CurrentUser | null>(null)

vi.mock('../../composables/useCurrentUser', () => ({ useCurrentUser: () => user }))
vi.mock('../../service/cvApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../service/cvApi')>()
  return {
    ...original,
    getCvs: vi.fn<typeof original.getCvs>(),
    importCvPdf: vi.fn<typeof original.importCvPdf>(),
  }
})

const camille: CvSummary = { id: 'camille-martin', firstname: 'Camille', name: 'Martin', title: '' }

async function mountHome(cvs: CvSummary[] = [camille]) {
  vi.mocked(getCvs).mockResolvedValue(cvs)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/cv/:id', component: { template: '<p>CV</p>' } },
    ],
  })
  await router.push('/')
  const wrapper = mount(HomeView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

const welcome = (wrapper: Awaited<ReturnType<typeof mountHome>>['wrapper']) =>
  wrapper.find('.home__welcome')

beforeEach(() => {
  user.value = { email: 'raphael.grand@zenika.com', name: 'Raphael GRAND' }
})

afterEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
})

describe('HomeView welcome', () => {
  it('offers to import their CV to a user who has none', async () => {
    const { wrapper } = await mountHome()
    expect(welcome(wrapper).text()).toContain('Bienvenue Raphael GRAND !')
  })

  it('stays hidden when a CV already bears the user name', async () => {
    const { wrapper } = await mountHome([
      camille,
      { id: 'raphael-grand', firstname: 'Raphaël', name: 'Grand', title: '' },
    ])
    expect(welcome(wrapper).exists()).toBe(false)
  })

  it('stays hidden until the user is known', async () => {
    user.value = null
    const { wrapper } = await mountHome()
    expect(welcome(wrapper).exists()).toBe(false)
  })

  it('remembers "Plus tard" for this user only', async () => {
    const { wrapper } = await mountHome()
    await welcome(wrapper).find('button').trigger('click')
    expect(welcome(wrapper).exists()).toBe(false)
    expect((await mountHome()).wrapper.find('.home__welcome').exists()).toBe(false)

    user.value = { email: 'jeanne.leroy@zenika.com', name: 'Jeanne Leroy' }
    expect((await mountHome()).wrapper.find('.home__welcome').exists()).toBe(true)
  })

  it('imports the PDF as the user own CV and opens it', async () => {
    vi.mocked(importCvPdf).mockResolvedValue({ id: 'raphael-grand', warnings: [] })
    const { wrapper, router } = await mountHome()
    const input = welcome(wrapper).find<HTMLInputElement>('input[type="file"]')
    const file = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()
    expect(importCvPdf).toHaveBeenCalledWith(file, { mine: true })
    expect(router.currentRoute.value.path).toBe('/cv/raphael-grand')
  })
})
