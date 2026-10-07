import { describe, expect, it } from 'vitest'
import { parsePattern } from './buildRows'
import { normalize } from './normalize'
import { detectSizes } from './sizes'

/**
 * Patronen in de stijl van PetiteKnit: maten tussen haakjes, blokken genummerde
 * rijen onder een kopregel, en een zin eronder die zegt hoe vaak je dat blok
 * breit. De tekst hieronder is zelf geschreven, niet uit een echt patroon
 * overgenomen.
 */
const PATTERN = `Maten: S (M) L (op de foto in maat S)
Naalden: Rondbreinaalden 5 mm
Stekenverhouding: 17 stn x 30 rijen = 10 x 10 cm

Boord
Zet 6 (8) 10 stn op. De eerste rij is een VK-rij.

Brei als volgt:
Rij 1 (VK): Brei recht tot de laatste 3 stn op de naald, haal de laatste 3 stn av af mdv
Rij 2 (GK): Brei als rij 1

Brei rijen 1 en 2 in totaal 3 (3) 3 maal.

Brei nu meerderingen in elke 2e rij. Brei als volgt:
Rij 1 (GK): Brei recht tot de laatste 2 stn op de naald, mva, 1r
Rij 2 (VK): Brei recht tot de laatste 3 stn op de naald, haal de laatste 3 stn av af mdv

Brei rijen 1 en 2 in totaal 4 (4) 4 maal. Er staan nu in totaal 10 (12) 14 stn op de naald.

Nu is het onderste deel gebreid en gaan we verder met de kap.

Brei nu heen en weer zoals beschreven met meerderingen zoals aangegeven tot er in totaal 20 stn
op de naald staan.

Afwerking
Naai de achterkant samen met de matras steek.

Afkortingen
mva Meerder voor en achter
2rsam brei 2 steken recht samen
VK verkeerde kant van het werk`

const parse = (index: number) =>
  parsePattern(PATTERN, { sizes: detectSizes(normalize(PATTERN)), sizeIndex: index })

describe('een patroon met maten tussen haakjes', () => {
  it('houdt alleen de gekozen maat over', () => {
    expect(parse(0).rows[0].instruction).toContain('Zet 6 stn op')
    expect(parse(2).rows[0].instruction).toContain('Zet 10 stn op')
  })

  it('telt het stekenaantal door tot het aantal dat het patroon zelf noemt', () => {
    for (const [index, expected] of [10, 12, 14].entries()) {
      const rows = parse(index).rows.filter((row) => row.kind === 'row')
      expect(rows[rows.length - 1].stitches).toBe(expected)
    }
  })
})

describe('de opbouw van zo’n patroon', () => {
  const result = parse(0)
  const knitRows = result.rows.filter((row) => row.kind === 'row')

  it('nummert doorlopend en houdt daarnaast de naam uit het patroon bij', () => {
    expect(knitRows.map((row) => row.label)).toEqual([
      'Rij 1', 'Rij 2', 'Rij 3', 'Rij 4', 'Rij 5', 'Rij 6',
      'Rij 7', 'Rij 8', 'Rij 9', 'Rij 10', 'Rij 11', 'Rij 12', 'Rij 13', 'Rij 14',
    ])
    expect(knitRows[0].patternLabel).toBe('Rij 1 (VK)')
    expect(knitRows[2].patternLabel).toBe('Rij 1 (VK)')
  })

  it('leest "in totaal 3 maal" als drie keer in het geheel, niet drie keer extra', () => {
    expect(knitRows.filter((row) => row.sectionId === result.sections[0].id)).toHaveLength(6)
  })

  it('vult "Brei als rij 1" in met wat daar staat', () => {
    expect(knitRows[1].instruction).toBe(knitRows[0].instruction)
    expect(knitRows[1].sourceRef).toBe('Brei als rij 1')
  })

  it('gebruikt een kopregel als onderdeel in plaats van als herhaling', () => {
    expect(result.sections.map((section) => section.name)).toEqual([
      'Boord',
      'Brei nu meerderingen in elke 2e rij',
      'Afwerking',
    ])
  })

  it('wisselt goede en verkeerde kant af vanaf de kant die het patroon noemt', () => {
    expect(knitRows.slice(0, 4).map((row) => row.side)).toEqual(['VK', 'GK', 'VK', 'GK'])
  })
})

describe('soorten regels', () => {
  const result = parse(0)
  const kindOf = (fragment: string) =>
    result.rows.find((row) => row.instruction.includes(fragment))?.kind

  it('maakt van een opdracht een stap en van uitleg een notitie', () => {
    expect(kindOf('Zet 6 stn op')).toBe('step')
    expect(kindOf('Naai de achterkant')).toBe('step')
    expect(kindOf('Nu is het onderste deel gebreid')).toBe('note')
  })

  it('maakt van een open herhaling één stap met een teller', () => {
    const row = result.rows.find((item) => item.kind === 'repeat-until')
    // Het blok dat eraan voorafgaat meerdert één steek per herhaling, en daar
    // moet hij mee doortellen tot de 20 die het patroon noemt.
    expect(row?.counter).toMatchObject({ done: 0, target: 20, from: 10, perRepeat: 1 })
  })

  it('zet patroongegevens apart in plaats van tussen de toeren', () => {
    expect(result.leftovers.join(' ')).toContain('Rondbreinaalden 5 mm')
    expect(result.rows.some((row) => row.instruction.includes('Stekenverhouding'))).toBe(false)
  })

  it('leest de afkortingen uit het patroon', () => {
    expect(result.glossary).toEqual([
      { term: 'mva', meaning: 'Meerder voor en achter' },
      { term: '2rsam', meaning: 'brei 2 steken recht samen' },
      { term: 'VK', meaning: 'verkeerde kant van het werk' },
    ])
  })
})
