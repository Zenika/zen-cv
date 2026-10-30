import { describe, expect, it } from 'vitest'
import { isSameName } from '../../shared/names.ts'

describe('isSameName', () => {
  const cv = { firstname: 'Raphaël', name: 'Grand' }

  it('ignores accents, case and word order', () => {
    expect(isSameName('Raphael GRAND', cv)).toBe(true)
    expect(isSameName('GRAND Raphaël', cv)).toBe(true)
    expect(isSameName('Jean-Marc Le Gall', { firstname: 'Jean Marc', name: 'LE GALL' })).toBe(true)
  })

  it('tells different people apart', () => {
    expect(isSameName('Raphael Grand', { firstname: 'Raphaël', name: 'Petit' })).toBe(false)
    expect(isSameName('Raphael', cv)).toBe(false)
  })
})
