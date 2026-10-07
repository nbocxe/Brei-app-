import { COUNT_SOURCE, parseCount } from './lexicon'

/** Een ontlede herhaalinstructie. */
export type RepeatSpec =
  /** "Herhaal toer 1-2 nog 4 keer" — verwijst naar genummerde toeren. */
  | { kind: 'rows'; from: number; to: number; times: number | null; total: boolean; untilStitches: number | null }
  /** "Herhaal deze 2 toeren nog 4 keer" — verwijst naar de laatste N toeren. */
  | { kind: 'last'; count: number; times: number | null; total: boolean; untilStitches: number | null }
  /** "Meerder om de 4 toeren, 10 keer" — meerdertoer plus gewone toeren. */
  | { kind: 'interval'; every: number; times: number | null; untilStitches: number | null; text: string }
  | { kind: 'unknown'; text: string }

const C = COUNT_SOURCE

const ROW_WORD = String.raw`toer(?:en)?|rij(?:en)?|naald(?:en)?|rows?|rounds?|rnds?`
const RANGE_JOIN = String.raw`[-–—]|t\/m|tot en met|tm|en|and|&|,`

const RANGE = new RegExp(
  String.raw`\b(?:${ROW_WORD})\s*\.?\s*(\d+)\s*(?:${RANGE_JOIN})\s*(\d+)\b`,
  'i',
)
const SINGLE = new RegExp(String.raw`\b(?:${ROW_WORD})\s*\.?\s*(\d+)\b`, 'i')

const LAST_N = new RegExp(
  String.raw`\b(?:deze|de\s+laatste|laatste|the\s+last|last)\s+(${C})\s*(?:${ROW_WORD})\b`,
  'i',
)

const INTERVAL_PATTERNS = [
  /\bom\s+de\s+(\d+)\s*(?:e|de|ste)?\s*(?:toer|rij|naald)/i,
  /\belke\s+(\d+)\s*(?:e|de|ste)\s*(?:toer|rij|naald)/i,
  /\bevery\s+(\d+)(?:st|nd|rd|th)?\s+(?:row|round)/i,
]

const TIMES = new RegExp(String.raw`(${C})\s*(?:more\s+|meer\s+)?(?:x\b|keer|maal|times?\b)`, 'i')
const ANOTHER = new RegExp(String.raw`\b(?:nog|another)\s+(${C})\b`, 'i')
/**
 * "in totaal 3 maal" telt de eerste keer mee. De woorden moeten wel bij het
 * aantal keren horen: "(voor in totaal 6 rijen)" zegt iets heel anders.
 */
const TOTAL = new RegExp(
  String.raw`\b(?:in\s+totaal|totaal|a\s+total\s+of|in\s+total)\s+(?:${C})\s*(?:x\b|keer|maal|times?\b)` +
    String.raw`|\beenmaal\b|\bonce\b`,
  'i',
)
const UNTIL_STITCHES =
  /\b(?:tot|totdat|until)\b[^.]{0,60}?(\d+)\s*(?:st\.?|sts\.?|steken|stitches)/i

function readTimes(text: string): number | null {
  return parseCount(TIMES.exec(text)?.[1]) ?? parseCount(ANOTHER.exec(text)?.[1])
}

function readUntilStitches(text: string): number | null {
  const value = UNTIL_STITCHES.exec(text)?.[1]
  return value ? Number(value) : null
}

/**
 * "Brei rijen 1-4 eenmaal, brei dan rijen 3 en 4 nog 1 maal" zijn twee
 * instructies in één zin. Die worden apart afgehandeld.
 */
const COMPOUND = /,\s*(?:brei\s+dan|dan|daarna|vervolgens|then|and\s+then)\s+/i

export function splitRepeats(raw: string): string[] {
  const parts = raw
    .split(COMPOUND)
    .map((part) => part.trim())
    .filter((part) => part !== '')
  return parts.length > 0 ? parts : [raw]
}

/**
 * Ontleedt één herhaalzin. Wat niet herkend wordt komt als 'unknown' terug en
 * belandt zo zichtbaar in het reviewscherm — nooit stilletjes weg.
 */
export function parseRepeat(raw: string): RepeatSpec {
  const text = raw.trim()
  const times = readTimes(text)
  const untilStitches = readUntilStitches(text)
  const total = TOTAL.test(text)

  const range = RANGE.exec(text)
  if (range) {
    const from = Number(range[1])
    const to = Number(range[2])
    if (to >= from) return { kind: 'rows', from, to, times, total, untilStitches }
  }

  const lastN = LAST_N.exec(text)
  if (lastN) {
    const count = parseCount(lastN[1])
    if (count && count > 0) return { kind: 'last', count, times, total, untilStitches }
  }

  for (const pattern of INTERVAL_PATTERNS) {
    const match = pattern.exec(text)
    if (match) {
      const every = Number(match[1])
      if (every > 0) return { kind: 'interval', every, times, untilStitches, text }
    }
  }

  const single = SINGLE.exec(text)
  if (single) {
    const from = Number(single[1])
    return { kind: 'rows', from, to: from, times, total, untilStitches }
  }

  return { kind: 'unknown', text }
}

/**
 * Hoe vaak het blok nog extra gebreid wordt.
 * "nog 4 keer" is vier keer extra, "in totaal 5 keer" is er vier bovenop de eerste.
 */
export function extraRuns(spec: { times: number | null; total: boolean }): number | null {
  if (spec.times === null) return null
  return spec.total ? Math.max(0, spec.times - 1) : spec.times
}

/** Of de formulering niet eenduidig zegt of het aantal inclusief de eerste keer is. */
export function isAmbiguousCount(raw: string): boolean {
  if (TOTAL.test(raw)) return false
  return !/\b(?:nog|another|more)\b/i.test(raw) && TIMES.test(raw)
}
