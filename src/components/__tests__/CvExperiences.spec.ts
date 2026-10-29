import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CvExperiences from '../CvExperiences.vue'
import type { SaveCv } from '../../composables/useCv'
import type { Experience } from '../../types'

const experience = (name: string): Experience => ({
  name,
  position: 'Développeuse',
  period: '2024',
  context: 'Contexte.',
  realisations: [],
  technicalEnvironment: [],
})

const experiences = [experience('Alpha'), experience('Beta'), experience('Gamma')]

function mountList(save: SaveCv = vi.fn<SaveCv>().mockResolvedValue(true)) {
  return mount(CvExperiences, {
    props: { experiences, save, saveError: null },
    attachTo: document.body,
  })
}

const names = (wrapper: ReturnType<typeof mountList>) =>
  wrapper.findAll('.experience-card__company').map((title) => title.text())

describe('CvExperiences', () => {
  it('lists the experiences in order', () => {
    const wrapper = mountList()
    expect(names(wrapper)).toEqual(['Alpha', 'Beta', 'Gamma'])
    wrapper.unmount()
  })

  it('moves an experience with the arrow keys, optimistically', async () => {
    const save = vi.fn<SaveCv>().mockResolvedValue(true)
    const wrapper = mountList(save)
    const cards = wrapper.findAll('.experience-card')
    await cards[1]!.trigger('keydown', { key: 'ArrowUp' })
    expect(save).toHaveBeenLastCalledWith(
      { experiences: [experiences[1], experiences[0], experiences[2]] },
      { optimistic: true },
    )

    await cards[2]!.trigger('keydown', { key: 'ArrowDown' })
    await cards[0]!.trigger('keydown', { key: 'ArrowUp' })
    expect(save).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('adds a new experience at the top', async () => {
    const save = vi.fn<SaveCv>().mockResolvedValue(true)
    const wrapper = mountList(save)
    await wrapper.find('.experience-list__add').trigger('click')
    const form = wrapper.find('.experience-form')
    const inputs = form.findAll('input')
    await inputs[0]!.setValue('Delta')
    await inputs[1]!.setValue('Tech lead')
    await inputs[2]!.setValue('2025')
    await form.find('textarea').setValue('Contexte.')
    await form.trigger('submit')
    await flushPromises()

    expect(save.mock.calls[0]![0].experiences!.map(({ name }) => name)).toEqual([
      'Delta',
      'Alpha',
      'Beta',
      'Gamma',
    ])
    expect(wrapper.find('.experience-form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the form open when saving fails', async () => {
    const wrapper = mountList(vi.fn<SaveCv>().mockResolvedValue(false))
    await wrapper.find('[aria-label="Modifier l\'expérience Beta"]').trigger('click')
    await wrapper.find('.experience-form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.experience-form').exists()).toBe(true)
    wrapper.unmount()
  })

  it('replaces the edited experience only', async () => {
    const save = vi.fn<SaveCv>().mockResolvedValue(true)
    const wrapper = mountList(save)
    await wrapper.find('[aria-label="Modifier l\'expérience Beta"]').trigger('click')
    expect(names(wrapper)).toEqual(['Alpha', 'Gamma'])
    await wrapper.find('.experience-form input').setValue('Beta 2')
    await wrapper.find('.experience-form').trigger('submit')
    await flushPromises()

    expect(save).toHaveBeenCalledWith({
      experiences: [experiences[0], { ...experiences[1], name: 'Beta 2' }, experiences[2]],
    })
    expect(wrapper.find('.experience-form').exists()).toBe(false)
    wrapper.unmount()
  })
})
