import { describe, expect, it } from 'vitest'
import { applySize, detectSizes } from './sizes'

const apply = (text: string, index: number) => {
  const sizes = detectSizes(text)
  if (!sizes) throw new Error('geen maten gevonden')
  return applySize(text, sizes, index).text
}

describe('maten herkennen', () => {
  it('leest drie maten met een opmerking erachter', () => {
    const sizes = detectSizes('Maten: S (M) L (op de foto in maat S)')
    expect(sizes?.names).toEqual(['S', 'M', 'L'])
    expect(sizes?.parenthesised).toEqual([false, true, false])
  })

  it('leest vijf maten', () => {
    expect(detectSizes('Maten: XS (S) M (L) XL')?.names).toEqual(['XS', 'S', 'M', 'L', 'XL'])
  })

  it('leest maten die met streepjes gescheiden zijn', () => {
    expect(detectSizes('Maten: XS - S - M - L')?.names).toEqual(['XS', 'S', 'M', 'L'])
  })

  it('geeft niets terug als er geen matenregel is', () => {
    expect(detectSizes('Zet 30 steken op.\nToer 1: recht')).toBeNull()
  })
})

describe('maat toepassen', () => {
  const header = 'Maten: S (M) L\n'

  it('houdt alleen de gekozen maat over', () => {
    expect(apply(`${header}Zet 6 (8) 10 stn op.`, 0)).toContain('Zet 6 stn op.')
    expect(apply(`${header}Zet 6 (8) 10 stn op.`, 1)).toContain('Zet 8 stn op.')
    expect(apply(`${header}Zet 6 (8) 10 stn op.`, 2)).toContain('Zet 10 stn op.')
  })

  it('werkt ook bij rangtelwoorden', () => {
    expect(apply(`${header}Brei meerderingen in elke 6e (8e) 10e rij`, 1)).toContain(
      'in elke 8e rij',
    )
  })

  it('laat losse getallen met rust', () => {
    const text = apply(`${header}Rondbreinaalden 5 mm / 60 cm, 7 stn voor alle maten`, 0)
    expect(text).toContain('5 mm / 60 cm')
    expect(text).toContain('7 stn voor alle maten')
  })

  it('ziet een kantaanduiding niet aan voor een maatgroep', () => {
    expect(apply(`${header}Rij 1 (VK): 2r, mva, brei recht`, 0)).toContain('Rij 1 (VK): 2r, mva')
  })

  it('laat een stekenaantal tussen haakjes staan', () => {
    expect(apply(`${header}Toer 1: recht tot einde (24 st)`, 0)).toContain('(24 st)')
  })

  it('telt hoeveel groepen zijn teruggebracht', () => {
    const text = `${header}Brei rijen 1-4 in totaal 3 (3) 3 maal. Er staan nu 39 (39) 39 stn.`
    const sizes = detectSizes(text)!
    expect(applySize(text, sizes, 0).replaced).toBe(2)
  })

  it('verwerkt vijf maten in de juiste volgorde', () => {
    const text = 'Maten: XS (S) M (L) XL\nZet 1 (2) 3 (4) 5 stn op.'
    const sizes = detectSizes(text)!
    expect(applySize(text, sizes, 3).text).toContain('Zet 4 stn op.')
  })

  it('verandert niets bij een maat die niet bestaat', () => {
    const text = `${header}Zet 6 (8) 10 stn op.`
    const sizes = detectSizes(text)!
    expect(applySize(text, sizes, 9)).toEqual({ text, replaced: 0 })
  })
})
