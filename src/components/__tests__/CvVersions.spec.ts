import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import CvVersions from '../CvVersions.vue'
import type { CvVersion } from '../../types'

type Create = (label: string) => Promise<string | null>
type Rename = (label: string) => Promise<boolean>

const versions: CvVersion[] = [
  { id: 'camille-martin', label: null },
  { id: 'camille-martin-v2', label: 'Banque' },
]

async function mountVersions(props: Partial<InstanceType<typeof CvVersions>['$props']> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/cv/:id', component: { template: '<p>CV</p>' } }],
  })
  await router.push(`/cv/${props.currentId ?? 'camille-martin'}`)
  const wrapper = mount(CvVersions, {
    props: {
      versions,
      currentId: 'camille-martin',
      editable: true,
      error: null,
      create: vi.fn<Create>().mockResolvedValue('camille-martin-v3'),
      rename: vi.fn<Rename>().mockResolvedValue(true),
      ...props,
    },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  return { wrapper, router }
}

describe('CvVersions', () => {
  it('lists the main CV and its versions, the current one first marked', async () => {
    const { wrapper } = await mountVersions()
    expect(wrapper.findAll('.cv-versions__item').map((item) => item.text())).toEqual([
      'CV principal',
      'Banque',
    ])
    expect(wrapper.find('[aria-current="page"]').text()).toBe('CV principal')
    expect(wrapper.find('a').attributes('href')).toBe('/cv/camille-martin-v2')
    wrapper.unmount()
  })

  it('creates a version with its label and opens it', async () => {
    const create = vi.fn<Create>().mockResolvedValue('camille-martin-v3')
    const { wrapper, router } = await mountVersions({ create })
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true
    }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false
    }
    await wrapper.find('.cv-versions__add').trigger('click')
    await wrapper.find('.cv-versions__input').setValue('  Assurance ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledWith('Assurance')
    expect(router.currentRoute.value.path).toBe('/cv/camille-martin-v3')
    wrapper.unmount()
  })

  it('renames the current version', async () => {
    const rename = vi.fn<Rename>().mockResolvedValue(true)
    const { wrapper } = await mountVersions({ currentId: 'camille-martin-v2', rename })
    await wrapper.find('.cv-versions__rename').trigger('click')
    await wrapper.find('.inline-edit__field').setValue('Assurance')
    await wrapper.find('.inline-edit').trigger('submit')
    expect(rename).toHaveBeenCalledWith('Assurance')
    wrapper.unmount()
  })

  it('only shows the versions when the CV is read-only', async () => {
    const { wrapper } = await mountVersions({ currentId: 'camille-martin-v2', editable: false })
    expect(wrapper.findAll('button')).toEqual([])
    expect(wrapper.find('[aria-current="page"]').text()).toBe('Banque')
    wrapper.unmount()
  })

  it('stays hidden for a read-only CV without versions', async () => {
    const { wrapper } = await mountVersions({ versions: versions.slice(0, 1), editable: false })
    expect(wrapper.find('.cv-versions').exists()).toBe(false)
    wrapper.unmount()
  })
})
