import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CvSkills from '../CvSkills.vue'
import type { UserData } from '../../types'

const cv = (skills: Partial<UserData>) =>
  ({
    expertise: [],
    methodologies: [],
    trainer: [],
    certifications: [],
    ...skills,
  }) as unknown as UserData

const titles = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.skills__title').map((title) => title.text())

describe('CvSkills', () => {
  it('shows every block that has entries', () => {
    const wrapper = mount(CvSkills, {
      props: {
        cv: cv({
          expertise: [{ name: 'Vue', level: 'Expert' }],
          methodologies: ['TDD'],
          trainer: ['Formateur Vue'],
          certifications: ['CKAD'],
        }),
      },
    })
    expect(titles(wrapper)).toEqual(['Expertises', 'Méthodologies', 'Formateur', 'Certifications'])
  })

  it('hides the empty blocks', () => {
    const wrapper = mount(CvSkills, {
      props: { cv: cv({ methodologies: ['Scrum'], certifications: ['CKAD'] }) },
    })
    expect(titles(wrapper)).toEqual(['Méthodologies', 'Certifications'])
  })

  it('hides the grey area when every block is empty', () => {
    expect(
      mount(CvSkills, { props: { cv: cv({}) } })
        .find('.skills')
        .exists(),
    ).toBe(false)
  })
})
