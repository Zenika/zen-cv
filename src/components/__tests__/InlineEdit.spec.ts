import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import InlineEdit from '../InlineEdit.vue'

const saveMock = () => vi.fn<(value: string) => Promise<boolean>>()

function mountInlineEdit(save: (value: string) => Promise<boolean>, multiline = false) {
  return mount(InlineEdit, {
    props: { value: 'Développeuse', label: 'Titre du CV', multiline, save },
    slots: {
      default: ({ edit }: { edit: () => void }) =>
        h('button', { class: 'edit', onClick: edit }, 'Modifier'),
    },
    attachTo: document.body,
  })
}

describe('InlineEdit', () => {
  it('shows the slot until editing starts', async () => {
    const wrapper = mountInlineEdit(saveMock())
    expect(wrapper.find('form').exists()).toBe(false)

    await wrapper.find('.edit').trigger('click')
    await flushPromises()
    const field = wrapper.find<HTMLInputElement>('input')
    expect(field.element.value).toBe('Développeuse')
    expect(field.attributes('aria-label')).toBe('Titre du CV')
    expect([field.element.selectionStart, field.element.selectionEnd]).toEqual([0, 12])
    wrapper.unmount()
  })

  it('uses a focused textarea when multiline', async () => {
    const wrapper = mountInlineEdit(saveMock(), true)
    await wrapper.find('.edit').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('textarea').element)
    wrapper.unmount()
  })

  it('saves the trimmed value and closes once saved', async () => {
    const save = saveMock().mockResolvedValue(true)
    const wrapper = mountInlineEdit(save)
    await wrapper.find('.edit').trigger('click')
    await wrapper.find('input').setValue('  Architecte  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(save).toHaveBeenCalledWith('Architecte')
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('stays open with the draft when saving fails', async () => {
    const wrapper = mountInlineEdit(saveMock().mockResolvedValue(false))
    await wrapper.find('.edit').trigger('click')
    await wrapper.find('input').setValue('Architecte')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find<HTMLInputElement>('input').element.value).toBe('Architecte')
    wrapper.unmount()
  })

  it('saves with Ctrl+Enter', async () => {
    const save = saveMock().mockResolvedValue(true)
    const wrapper = mountInlineEdit(save, true)
    await wrapper.find('.edit').trigger('click')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(save).toHaveBeenCalledWith('Développeuse')
    wrapper.unmount()
  })

  it('cancels without saving', async () => {
    const save = saveMock()
    const wrapper = mountInlineEdit(save)
    await wrapper.find('.edit').trigger('click')
    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('form').exists()).toBe(false)

    await wrapper.find('.edit').trigger('click')
    await wrapper.find('button[type="button"]').trigger('click')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(save).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
