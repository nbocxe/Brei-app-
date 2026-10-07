import { detectSide, estimateStitchDelta, extractStitchCount, mentionsStitchChange } from './lexicon'
import type { Side } from './types'

export type BlockContent = {
  instruction: string
  side: Side
  /** Stekenaantal dat letterlijk in het patroon staat. */
  stitches: number | null
  /** Verandering van het stekenaantal, afgeleid uit de steeksoorten. */
  delta: number
  /** Aantal steken dat hier wordt opgezet. */
  castOn: number | null
  /** De parser kon het stekenaantal niet volgen. */
  uncertainStitches: boolean
}

/** Stekenaantallen die achteraan de instructie staan horen in de eigen kolom. */
const TRAILING_COUNT =
  /\s*(?:[(\[]\s*(?:→|->|=)?\s*\d+\s*(?:st\.?|sts\.?|steken|steek|stitches|stitch)?\s*[)\]]|(?:=|→|->)\s*\d+\s*(?:st\.?|sts\.?|steken|steek|stitches|stitch)?)\s*[.;]?\s*$/i

const CAST_ON_PATTERNS = [
  /\b(?:zet|sla|breit?)\s+(\d+)\s*(?:st\.?|steken)?\s*op\b/i,
  /\b(\d+)\s*(?:st\.?|steken)\s*opzetten\b/i,
  /\bcast\s+on\s+(\d+)\b/i,
  /\bco\s+(\d+)\s*(?:st\.?|sts\.?)?\b/i,
]

export function detectCastOn(text: string): number | null {
  for (const pattern of CAST_ON_PATTERNS) {
    const match = pattern.exec(text)
    if (match) {
      const value = Number(match[1])
      if (Number.isFinite(value) && value > 0) return value
    }
  }
  return null
}

/** Instructies waarvan het stekenaantal niet te volgen is zonder het patroon te lezen. */
const UNCOUNTABLE =
  /\b(?:afkanten|bind\s+off|cast\s+off|kant\s+.{0,12}\s*af|verdeel|verdeeld|opnieuw\s+opzetten|steken\s+(?:stil|op\s+een\s+hulpdraad))\b/i

/** Ontleedt de tekst van één toer. */
export function parseBlockContent(body: string, declaredSide: Side = null): BlockContent {
  const text = body.trim()
  const stitches = extractStitchCount(text)
  const castOn = detectCastOn(text)

  let instruction = text.replace(TRAILING_COUNT, '').trim()
  if (instruction === '') instruction = text

  return {
    instruction,
    side: declaredSide ?? detectSide(text),
    stitches,
    delta: estimateStitchDelta(instruction),
    castOn,
    uncertainStitches:
      UNCOUNTABLE.test(text) ||
      // "meerder aan beide zijden" zegt niet hoeveel steken erbij komen.
      (/\b(?:beide\s+zijden|both\s+(?:ends|sides)|aan\s+weerszijden)\b/i.test(text) &&
        mentionsStitchChange(text)),
  }
}
