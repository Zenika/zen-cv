import { describe, expect, it } from 'vitest'
import { isSameName, matchesSearch } from '../../shared/names.ts'

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

describe('matchesSearch', () => {
  const cv = { firstname: 'Raphaël', name: 'Le Grand' }

  it('finds a CV from parts of its name, in any order, ignoring accents and case', () => {
    for (const query of ['', '  ', 'raph', 'RAPHAEL', 'grand raph', 'le gr', 'Raphaël-Le']) {
      expect(matchesSearch(query, cv)).toBe(true)
    }
  })

  it('needs every word typed', () => {
    expect(matchesSearch('raphael petit', cv)).toBe(false)
    expect(matchesSearch('camille', cv)).toBe(false)
  })
})
