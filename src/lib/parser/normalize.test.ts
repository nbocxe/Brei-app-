import { describe, expect, it } from 'vitest'
import { normalize } from './normalize'

describe('rommelige PDF-tekst opschonen', () => {
  it('plakt een ingesprongen vervolgregel aan de regel ervoor', () => {
    const page = [
      'Rij 1 (VK): Brei recht tot de laatste 3 stn, haal de laatste 3 stn av af met de draad voor het',
      '                           werk (mdv)',
    ].join('\n')
    expect(normalize([page])).toBe(
      'Rij 1 (VK): Brei recht tot de laatste 3 stn, haal de laatste 3 stn av af met de draad voor het werk (mdv)',
    )
  })

  it('houdt een lijst met afkortingen uit elkaar, maar plakt hun vervolgregels wel aan', () => {
    const page = [
      'Afkortingen',
      'aro haal 1 steek recht af, 1r, haal de afgehaalde steek over',
      'av brei averecht',
      'mva Meerder voor en achter; brei eerst in de voorste draad en dan',
      '        in de achterste draad van dezelfde steek',
      'mdv met de draad voor het werk',
    ].join('\n')

    expect(normalize([page]).split('\n')).toEqual([
      'Afkortingen',
      'aro haal 1 steek recht af, 1r, haal de afgehaalde steek over',
      'av brei averecht',
      'mva Meerder voor en achter; brei eerst in de voorste draad en dan in de achterste draad van dezelfde steek',
      'mdv met de draad voor het werk',
    ])
  })

  it('plakt zonder inspringing nog steeds doorlopende zinnen aan elkaar', () => {
    expect(normalize('Toer 1: recht tot de laatste twee ste-\nken, mva, 1 recht')).toBe(
      'Toer 1: recht tot de laatste twee steken, mva, 1 recht',
    )
  })
})
