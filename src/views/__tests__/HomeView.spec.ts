import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { claimCv, getCvs, importCvPdf } from '../../service/cvApi'
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
    claimCv: vi.fn<typeof original.claimCv>(),
  }
})

const camille: CvSummary = {
  id: 'camille-martin',
  firstname: 'Camille',
  name: 'Martin',
  title: '',
  ownerEmail: null,
}
const raphael: CvSummary = {
  id: 'raphael-grand',
  firstname: 'Raphaël',
  name: 'Grand',
  title: 'Développeur',
  ownerEmail: null,
}

async function mountHome(cvs: CvSummary[] = [camille], path = '/') {
  vi.mocked(getCvs).mockResolvedValue(cvs)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/cv/:id', component: { template: '<p>CV</p>' } },
    ],
  })
  await router.push(path)
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
    expect(welcome(wrapper).text()).toContain('Aucun CV à votre nom')
  })

  it('stays hidden when the user owns a CV, and marks it', async () => {
    const { wrapper } = await mountHome([
      camille,
      { ...raphael, name: 'Autre nom', ownerEmail: 'raphael.grand@zenika.com' },
    ])
    expect(welcome(wrapper).exists()).toBe(false)
    expect(wrapper.findAll('.home__card').map((card) => card.find('.home__mine').exists())).toEqual(
      [false, true],
    )
  })

  it('asks whether an unowned CV bearing the user name is theirs', async () => {
    vi.mocked(claimCv).mockResolvedValue()
    const { wrapper } = await mountHome([camille, raphael])
    expect(welcome(wrapper).text()).toContain('Est-ce le vôtre ?')
    expect(
      welcome(wrapper)
        .findAll('.home__candidate')
        .map((item) => item.text()),
    ).toEqual(["Raphaël Grand C'est mon CV"])

    vi.mocked(getCvs).mockResolvedValue([
      camille,
      { ...raphael, ownerEmail: 'raphael.grand@zenika.com' },
    ])
    await welcome(wrapper).find('.home__candidate button').trigger('click')
    await flushPromises()
    expect(claimCv).toHaveBeenCalledWith('raphael-grand')
    expect(welcome(wrapper).exists()).toBe(false)
    expect(wrapper.find('.home__mine').exists()).toBe(true)
  })

  it('explains why the CV could not be claimed', async () => {
    vi.mocked(claimCv).mockRejectedValue(new Error('ce CV appartient déjà à quelqu’un d’autre.'))
    const { wrapper } = await mountHome([camille, raphael])
    await welcome(wrapper).find('.home__candidate button').trigger('click')
    await flushPromises()
    expect(welcome(wrapper).find('[role="alert"]').text()).toContain(
      'ce CV appartient déjà à quelqu’un d’autre.',
    )
  })

  it('does not offer a CV someone else owns', async () => {
    const { wrapper } = await mountHome([{ ...raphael, ownerEmail: 'raphael.grand@autre.example' }])
    expect(welcome(wrapper).text()).toContain('Aucun CV à votre nom')
  })

  it('stays hidden until the user is known', async () => {
    user.value = null
    const { wrapper } = await mountHome()
    expect(welcome(wrapper).exists()).toBe(false)
  })

  it('remembers "Plus tard" for this user only', async () => {
    const { wrapper } = await mountHome()
    await welcome(wrapper).find('button:not(.button--primary)').trigger('click')
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

describe('HomeView list', () => {
  const names = (wrapper: Awaited<ReturnType<typeof mountHome>>['wrapper']) =>
    wrapper.findAll('.home__card').map((card) => card.text())

  it('shows only the names in the cards', async () => {
    const { wrapper } = await mountHome([camille, raphael])
    expect(names(wrapper)).toEqual(['Camille Martin', 'Raphaël Grand'])
    expect(wrapper.text()).not.toContain('Développeur')
  })

  it('filters the CVs by name and keeps the search in the URL', async () => {
    const { wrapper, router } = await mountHome([camille, raphael])
    await wrapper.find('input[type="search"]').setValue('raph')
    await flushPromises()
    expect(names(wrapper)).toEqual(['Raphaël Grand'])
    expect(wrapper.find('.home__count').text()).toBe('1 CV')
    expect(router.currentRoute.value.query).toEqual({ q: 'raph' })

    await wrapper.find('input[type="search"]').setValue('')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.find('.home__count').text()).toBe('2 CVs')
  })

  it('starts from the search in the URL and says when nothing matches', async () => {
    const { wrapper } = await mountHome([camille, raphael], '/?q=petit')
    expect(wrapper.find<HTMLInputElement>('input[type="search"]').element.value).toBe('petit')
    expect(names(wrapper)).toEqual([])
    expect(wrapper.find('.home__empty').text()).toBe('Aucun CV ne correspond à « petit ».')
  })
})
