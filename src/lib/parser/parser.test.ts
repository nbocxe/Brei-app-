import { describe, expect, it } from 'vitest'
import { parsePattern } from './buildRows'
import { normalize } from './normalize'
import { extractStitchCount, estimateStitchDelta, detectSide } from './lexicon'
import { parseRepeat } from './repeats'

const sides = (rows: { side: string | null }[]) => rows.map((row) => row.side)
const stitches = (rows: { stitches: number | null }[]) => rows.map((row) => row.stitches)
const numbers = (rows: { rowNumber: number | null }[]) => rows.map((row) => row.rowNumber)

describe('losse onderdelen', () => {
  it('leest stekenaantallen in de gangbare schrijfwijzen', () => {
    expect(extractStitchCount('recht tot einde (24 st)')).toBe(24)
    expect(extractStitchCount('recht tot einde (→ 24)')).toBe(24)
    expect(extractStitchCount('averecht = 30 steken')).toBe(30)
    expect(extractStitchCount('knit to end (42 sts)')).toBe(42)
    expect(extractStitchCount('er blijven 18 steken op de naald over')).toBe(18)
  })

  it('ziet een herhaling tussen haakjes niet aan voor een stekenaantal', () => {
    expect(extractStitchCount('*2 recht, 2 averecht* herhalen (4x)')).toBeNull()
  })

  it('telt meerderingen en minderingen', () => {
    expect(estimateStitchDelta('recht tot laatste 2, mva, 1 recht')).toBe(1)
    expect(estimateStitchDelta('1 recht, k2tog, recht tot laatste 3, ssk, 1 recht')).toBe(-2)
    expect(estimateStitchDelta('3 samen breien')).toBe(-2)
    expect(estimateStitchDelta('alles recht breien')).toBe(0)
  })

  it('herkent de kant van het werk', () => {
    expect(detectSide('Toer 1 (GK)')).toBe('GK')
    expect(detectSide('verkeerde kant')).toBe('VK')
    expect(detectSide('Row 3 (RS)')).toBe('GK')
    expect(detectSide('alles recht')).toBeNull()
  })

  it('ontleedt herhaalzinnen', () => {
    expect(parseRepeat('Herhaal toer 1 en 2 nog 4 keer')).toMatchObject({
      kind: 'rows', from: 1, to: 2, times: 4, total: false,
    })
    expect(parseRepeat('Repeat rows 3-6 ten more times')).toMatchObject({
      kind: 'rows', from: 3, to: 6, times: 10,
    })
    expect(parseRepeat('Herhaal deze 2 toeren in totaal 5 keer')).toMatchObject({
      kind: 'last', count: 2, times: 5, total: true,
    })
    expect(parseRepeat('Herhaal toer 1-2 tot je 40 steken hebt')).toMatchObject({
      kind: 'rows', from: 1, to: 2, untilStitches: 40,
    })
    expect(parseRepeat('Meerder aan beide zijden om de 4 toeren, 6 keer')).toMatchObject({
      kind: 'interval', every: 4, times: 6,
    })
  })
})

describe('het patroon uit het voorbeeld', () => {
  const result = parsePattern(`
Zet 23 steken op.

Toer 1 (GK): recht tot de laatste 2 steken, mva, 1 recht (24 st)
Toer 2 (VK): 1 recht, mva, brei tot het einde (25 st)
Herhaal toer 1 en 2 nog 4 keer.
`)

  const knitRows = result.rows.filter((row) => row.label !== 'Opzetten')

  it('schrijft tien meerdertoeren uit', () => {
    expect(knitRows).toHaveLength(10)
    expect(numbers(knitRows)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('wisselt goede en verkeerde kant af', () => {
    expect(sides(knitRows)).toEqual(['GK', 'VK', 'GK', 'VK', 'GK', 'VK', 'GK', 'VK', 'GK', 'VK'])
  })

  it('telt het stekenaantal op van 24 naar 33', () => {
    expect(stitches(knitRows)).toEqual([24, 25, 26, 27, 28, 29, 30, 31, 32, 33])
  })

  it('begint met het opzetten van 23 steken', () => {
    expect(result.rows[0]).toMatchObject({ label: 'Opzetten', stitches: 23 })
  })

  it('houdt de instructietekst schoon, zonder het stekenaantal', () => {
    expect(knitRows[0].instruction).toBe('recht tot de laatste 2 steken, mva, 1 recht')
    expect(knitRows[1].instruction).toBe('1 recht, mva, brei tot het einde')
  })

  it('merkt de uitgeschreven toeren als afkomstig uit een herhaling', () => {
    expect(result.stats.fromRepeats).toBe(8)
  })
})

describe('herhalingen', () => {
  it('herhaalt de laatste toeren', () => {
    const result = parsePattern(`
Toer 1: recht
Toer 2: averecht
Herhaal deze 2 toeren nog 3 keer.
`)
    expect(result.rows).toHaveLength(8)
    expect(numbers(result.rows)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(sides(result.rows)).toEqual(['GK', 'VK', 'GK', 'VK', 'GK', 'VK', 'GK', 'VK'])
  })

  it('rekent in totaal anders dan nog', () => {
    const totaal = parsePattern('Toer 1: recht\nToer 2: averecht\nHerhaal toer 1-2 in totaal 3 keer.')
    expect(totaal.rows).toHaveLength(6)

    const nog = parsePattern('Toer 1: recht\nToer 2: averecht\nHerhaal toer 1-2 nog 3 keer.')
    expect(nog.rows).toHaveLength(8)
  })

  it('schrijft uit tot een stekenaantal bereikt is', () => {
    const result = parsePattern(`
Zet 20 steken op.
Toer 1 (GK): 1 recht, mva, recht tot laatste 2, mva, 1 recht
Toer 2 (VK): averecht
Herhaal toer 1 en 2 tot je 30 steken hebt.
`)
    const last = result.rows[result.rows.length - 1]
    expect(last.stitches).toBe(30)
  })

  it('schrijft een intervalherhaling uit als meerdertoer plus gewone toeren', () => {
    const result = parsePattern(`
Zet 30 steken op.
Toer 1 (GK): recht
Meerder aan het begin van de toer om de 4 toeren, 3 keer.
`)
    const afterFirst = result.rows.slice(2)
    expect(afterFirst).toHaveLength(12)
    expect(afterFirst[0].needsCheck).toBe(true)
    expect(afterFirst[0].note).toMatch(/om de 4 toeren/i)
  })

  it('kapt onbegrepen herhalingen niet weg maar markeert ze', () => {
    const result = parsePattern(`
Toer 1: recht
Herhaal tot het werk 30 cm meet.
`)
    const flagged = result.rows.filter((row) => row.needsCheck)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].instruction).toMatch(/30 cm/)
  })
})

describe('Engelse patronen', () => {
  const result = parsePattern(`
Cast on 40 stitches.

Row 1 (RS): knit to last 2 sts, M1, k1 (41 sts)
Row 2 (WS): purl
Repeat rows 1-2 three more times.
`)

  it('gebruikt Engelse benamingen', () => {
    expect(result.lang).toBe('en')
    expect(result.rows[0].label).toBe('Cast on')
    expect(result.rows[1].label).toBe('Row 1')
  })

  it('telt door vanaf het opzetten', () => {
    expect(result.rows[0].stitches).toBe(40)
    expect(stitches(result.rows.slice(1))).toEqual([41, 41, 42, 42, 43, 43, 44, 44])
  })
})

describe('rommelige PDF-tekst', () => {
  it('plakt afgebroken woorden en doorlopende regels weer aan elkaar', () => {
    const text = normalize('Toer 1: recht tot de laatste twee ste-\nken, mva, 1 recht\n\nToer 2: averecht')
    expect(text).toContain('laatste twee steken, mva, 1 recht')
  })

  it('gooit kop- en voetteksten weg die op elke pagina staan', () => {
    const pages = [
      'Sjaal in ribbelsteek\nToer 1: recht\nPagina 1',
      'Sjaal in ribbelsteek\nToer 2: averecht\nPagina 2',
      'Sjaal in ribbelsteek\nToer 3: recht\nPagina 3',
    ]
    const text = normalize(pages)
    expect(text).not.toMatch(/Sjaal in ribbelsteek/)
    expect(text).not.toMatch(/Pagina/)
    expect(text.split('\n')).toHaveLength(3)
  })

  it('splitst toeren die op één regel aan elkaar geplakt zijn', () => {
    const result = parsePattern('Toer 1: recht Toer 2: averecht Toer 3: recht')
    expect(result.rows).toHaveLength(3)
    expect(result.rows[1].instruction).toBe('averecht')
  })

  it('bewaart prose die geen toer is apart in plaats van weg te gooien', () => {
    const result = parsePattern(`
Naalden: 4 mm
Garen: 100 g wol

Toer 1: recht
`)
    expect(result.rows).toHaveLength(1)
    expect(result.leftovers.join(' ')).toMatch(/4 mm/)
  })

  it('plakt losse regels niet aan elkaar tot één stap', () => {
    const result = parsePattern(`
Babytruitje in ribbelsteek
Naalden: 4 mm
Garen: 100 g merinowol
Voorpand
Zet 23 steken op.
Toer 1: recht
`)
    expect(result.rows[0]).toMatchObject({ label: 'Opzetten', stitches: 23 })
    expect(result.rows[0].instruction).toBe('Zet 23 steken op.')
    expect(result.leftovers).toHaveLength(2)
  })

  it('ziet de titel van het patroon niet aan voor een onderdeel', () => {
    const result = parsePattern(`
Babytruitje in ribbelsteek
Naalden: 4 mm
Voorpand
Toer 1: recht
`)
    expect(result.sections.map((section) => section.name)).toEqual(['Voorpand'])
  })

  it('verdeelt toeren over de onderdelen van het patroon', () => {
    const result = parsePattern(`
Voorpand

Toer 1: recht
Toer 2: averecht

Mouwen

Toer 1: recht
`)
    expect(result.sections.map((section) => section.name)).toEqual(['Voorpand', 'Mouwen'])
    expect(result.rows[0].sectionId).toBe('s1')
    expect(result.rows[2].sectionId).toBe('s2')
  })
})
