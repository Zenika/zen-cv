import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExperienceForm from '../ExperienceForm.vue'
import type { Experience } from '../../types'

const experience: Experience = {
  name: 'Banque Horizon',
  position: 'Développeuse',
  period: 'depuis 2024',
  team: 'équipe de 6',
  context: 'Refonte du SI.',
  realisations: [
    { title: 'Back', type: 'list', description: ['API', 'Batch'] },
    { title: 'Run', type: 'text', description: 'Astreintes' },
    { type: 'list', description: ['Revues de code'] },
  ],
  technicalEnvironment: [{ name: 'Backend', value: 'Java' }],
}

async function submit(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('form').trigger('submit')
  return wrapper.emitted<[Experience]>('save')![0]![0]
}

describe('ExperienceForm', () => {
  it('saves an unchanged experience as it was', async () => {
    const wrapper = mount(ExperienceForm, { props: { experience } })
    expect(await submit(wrapper)).toEqual(experience)
  })

  it('starts empty, with one realisation and one technical environment', () => {
    const wrapper = mount(ExperienceForm)
    expect(wrapper.findAll<HTMLInputElement>('input').map((input) => input.element.value)).toEqual([
      '',
      '',
      '',
      '',
      '',
      'Environnement technique',
      '',
    ])
  })

  it('builds the experience from the fields', async () => {
    const wrapper = mount(ExperienceForm)
    const inputs = wrapper.findAll('input')
    const textareas = wrapper.findAll('textarea')
    await inputs[0]!.setValue('TransLogis')
    await inputs[1]!.setValue('Tech lead')
    await inputs[2]!.setValue('2023')
    await textareas[0]!.setValue('Migration cloud.')
    await inputs[4]!.setValue('  Cloud  ')
    await textareas[1]!.setValue(' AWS \n\n Terraform ')
    await inputs[6]!.setValue(' Kubernetes ')

    expect(await submit(wrapper)).toEqual({
      name: 'TransLogis',
      position: 'Tech lead',
      period: '2023',
      context: 'Migration cloud.',
      realisations: [{ title: 'Cloud', type: 'list', description: ['AWS', 'Terraform'] }],
      technicalEnvironment: [{ name: 'Environnement technique', value: 'Kubernetes' }],
    })
  })

  it('stores a titled realisation with one line as text', async () => {
    const wrapper = mount(ExperienceForm)
    await wrapper.findAll('input')[4]!.setValue('Run')
    await wrapper.findAll('textarea')[1]!.setValue('Astreintes')
    expect((await submit(wrapper)).realisations).toEqual([
      { title: 'Run', type: 'text', description: 'Astreintes' },
    ])
  })

  it('drops empty realisations and technical environments', async () => {
    const wrapper = mount(ExperienceForm)
    await wrapper.find('fieldset button:not([aria-label])').trigger('click')
    const saved = await submit(wrapper)
    expect(saved.realisations).toEqual([])
    expect(saved.technicalEnvironment).toEqual([])
  })

  it('adds and removes realisations', async () => {
    const wrapper = mount(ExperienceForm, { props: { experience } })
    await wrapper.find('[aria-label="Supprimer la réalisation"]').trigger('click')
    expect((await submit(wrapper)).realisations).toEqual(experience.realisations.slice(1))
  })

  it('emits cancel', async () => {
    const wrapper = mount(ExperienceForm, { props: { experience } })
    await wrapper.find('.experience-form__actions button[type="button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
