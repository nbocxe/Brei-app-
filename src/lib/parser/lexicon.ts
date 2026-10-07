import type { Lang, Side } from './types'

/** Woorden die een toer aankondigen, voluit geschreven. */
const ROW_WORDS_NL = ['toeren', 'toer', 'rijen', 'rij', 'naalden', 'naald', 'nld']
const ROW_WORDS_EN = ['rounds', 'round', 'rows', 'row', 'rnds', 'rnd']

/** Letters die alleen als toermarkering gelden als er direct een cijfer op volgt (R1, T3). */
const ROW_LETTERS = ['r', 't']

const ROW_WORDS = [...ROW_WORDS_NL, ...ROW_WORDS_EN]

/** Verbindingswoorden in een reeks: "toer 1-2", "toer 1 t/m 4", "rows 1 and 2". */
const RANGE_JOIN = String.raw`(?:[-–—]|t\/m|tot en met|tm|en|and|&|,)`

/**
 * Kop van een toer aan het begin van een regel.
 * Groepen: 1 = eerste nummer, 2 = laatste nummer van een reeks, 3 = haakjesinhoud, 4 = rest.
 */
export const ROW_HEADER = new RegExp(
  String.raw`^\s*(?:${ROW_WORDS.join('|')})\s*\.?\s*(\d+)` +
    String.raw`(?:\s*${RANGE_JOIN}\s*(\d+))?` +
    String.raw`\s*(?:\(([^)]*)\))?` +
    String.raw`\s*(?:[:.–—-]|\s)\s*([\s\S]*)$`,
  'i',
)

/** Korte vorm: R1, T12, Rnd4 — alleen met een cijfer er direct achter. */
export const ROW_HEADER_SHORT = new RegExp(
  String.raw`^\s*(?:${ROW_LETTERS.join('|')})\s?(\d+)` +
    String.raw`(?:\s*${RANGE_JOIN}\s*(\d+))?` +
    String.raw`\s*(?:\(([^)]*)\))?` +
    String.raw`\s*(?:[:.–—-]\s*|\s+)([\s\S]*)$`,
  'i',
)

/** Herkent of een regel een toerkop is, zonder hem te ontleden. */
export function looksLikeRowHeader(line: string): boolean {
  return ROW_HEADER.test(line) || ROW_HEADER_SHORT.test(line)
}

/** Markeringen voor de kant van het werk. */
const SIDE_GK =
  /\b(?:g\.?\s?k\.?|goede\s?kant|rechte\s?kant|r\.?\s?s\.?|right\s?side)\b/i
const SIDE_VK =
  /\b(?:v\.?\s?k\.?|verkeerde\s?kant|averechte\s?kant|w\.?\s?s\.?|wrong\s?side)\b/i

export function detectSide(text: string): Side {
  if (SIDE_GK.test(text)) return 'GK'
  if (SIDE_VK.test(text)) return 'VK'
  return null
}

/**
 * Stekenaantal uit een instructie. Drie veelgebruikte schrijfwijzen, en bij
 * meerdere treffers wint de laatste: die staat achter de toer.
 */
const STITCH_PATTERNS: RegExp[] = [
  // (24 st) · (24 steken) · [24 sts] · (→ 24) · (= 24)
  /[([]\s*(?:→|->|=)?\s*(\d+)\s*(?:st\.?|sts\.?|steken|steek|stitches|stitch)?\s*[)\]]/gi,
  // = 24 steken · — 24 sts
  /(?:=|→|->|[-–—])\s*(\d+)\s*(?:st\.?|sts\.?|steken|steek|stitches|stitch)\b/gi,
  // 24 steken op de naald · 24 stitches remain
  /(\d+)\s*(?:st\.?|sts\.?|steken|stitches)\s*(?:op\s+de\s+naald|totaal|in\s+totaal|remain(?:ing)?|on\s+the\s+needle|in\s+total)/gi,
]

export function extractStitchCount(text: string): number | null {
  let found: number | null = null
  for (const pattern of STITCH_PATTERNS) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      // Een los getal tussen haakjes is alleen een stekenaantal met pijl, is-teken
      // of eenheid erbij — anders is het vaak een herhaling ("(2x)").
      const whole = match[0]
      if (!/→|->|=|st|steek|steken|stitch/i.test(whole)) continue
      const value = Number(match[1])
      if (Number.isFinite(value) && value > 0 && value < 100000) found = value
    }
  }
  return found
}

/** Steken en hun effect op het aantal steken op de naald. */
const DELTA_RULES: { re: RegExp; delta: number }[] = [
  // Minderingen van twee steken tegelijk eerst, anders vangt de -1 regel ze af.
  { re: /\b(?:k3tog|p3tog|cdd|sk2p|s2kp|3\s*samen(?:\s*breien)?)\b/gi, delta: -2 },
  {
    re: /\b(?:k2tog|p2tog|ssk|ssp|skpo|sl1\s*k1\s*psso|2\s*samen(?:\s*breien)?|samenbreien|minder(?:en|ing)?|dec(?:rease)?)\b/gi,
    delta: -1,
  },
  {
    re: /\b(?:mva|m1l|m1r|m1|kfb|pfb|yo|yfwd|omslag|meerder(?:en|ing)?|toename|inc(?:rease)?)\b/gi,
    delta: 1,
  },
]

/** Netto verandering van het stekenaantal, afgeleid uit de instructietekst. */
export function estimateStitchDelta(text: string): number {
  let delta = 0
  let remaining = text
  for (const rule of DELTA_RULES) {
    rule.re.lastIndex = 0
    const matches = remaining.match(rule.re)
    if (!matches) continue
    delta += matches.length * rule.delta
    // Uit de tekst halen zodat "3 samen" niet ook als "2 samen" meetelt.
    remaining = remaining.replace(rule.re, ' ')
  }
  return delta
}

/** Tekst die over het stekenaantal gaat zonder dat eroverheen te tellen valt. */
export function mentionsStitchChange(text: string): boolean {
  return DELTA_RULES.some((rule) => {
    rule.re.lastIndex = 0
    return rule.re.test(text)
  })
}

const NUMBER_WORDS: Record<string, number> = {
  een: 1, één: 1, eenmaal: 1, one: 1, once: 1,
  twee: 2, two: 2, twice: 2,
  drie: 3, three: 3,
  vier: 4, four: 4,
  vijf: 5, five: 5,
  zes: 6, six: 6,
  zeven: 7, seven: 7,
  acht: 8, eight: 8,
  negen: 9, nine: 9,
  tien: 10, ten: 10,
  elf: 11, eleven: 11,
  twaalf: 12, twelve: 12,
  dertien: 13, thirteen: 13,
  veertien: 14, fourteen: 14,
  vijftien: 15, fifteen: 15,
  zestien: 16, sixteen: 16,
  zeventien: 17, seventeen: 17,
  achttien: 18, eighteen: 18,
  negentien: 19, nineteen: 19,
  twintig: 20, twenty: 20,
}

/** "10", "tien" en "ten" leveren allemaal 10 op. */
export function parseCount(raw: string | undefined): number | null {
  if (!raw) return null
  const text = raw.trim().toLowerCase()
  if (/^\d+$/.test(text)) return Number(text)
  const word = NUMBER_WORDS[text]
  return word ?? null
}

export const COUNT_SOURCE = String.raw`\d+|${Object.keys(NUMBER_WORDS).join('|')}`

/** Grove taalherkenning, bepaalt alleen de standaardteksten die de app zelf toevoegt. */
export function detectLanguage(text: string): Lang {
  const nl = (text.match(/\b(?:toer|rij|naald|recht|averecht|steken|herhaal|mva|minder)\b/gi) ?? []).length
  const en = (text.match(/\b(?:row|round|knit|purl|stitches|repeat|cast on|bind off)\b/gi) ?? []).length
  return en > nl ? 'en' : 'nl'
}
