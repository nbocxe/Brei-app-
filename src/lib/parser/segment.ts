import { ROW_HEADER, ROW_HEADER_SHORT, detectSide, looksLikeRowHeader } from './lexicon'
import type { Block } from './types'

/**
 * Zinnen die een herhaling aankondigen. Niet elk patroon schrijft "herhaal":
 * PetiteKnit zegt "Brei rijen 1 en 2 in totaal 3 maal".
 */
const REPEAT_START =
  /^(?:herhaal|repeat|work\s+rows?|brei\s+(?:de\s+)?(?:laatste\s+\d+\s+)?(?:toer|toeren|rij|rijen|naald|naalden)\b)/i

/** "om de 4 toeren", "elke 4e toer", "every 4th row" — een herhaling met een interval. */
const INTERVAL =
  /\b(?:om\s+de\s+\d+\s*(?:e|de|ste)?\s*(?:toer|rij|naald)|elke\s+\d+\s*(?:e|de|ste)\s*(?:toer|rij|naald)|every\s+\d+(?:st|nd|rd|th)?\s+(?:row|round))/i

export function isRepeatLine(line: string): boolean {
  if (looksLikeRowHeader(line)) return false
  return REPEAT_START.test(line) || INTERVAL.test(line)
}

/**
 * Een toerkop midden in een regel, herkenbaar aan de dubbele punt erachter.
 * Een eventueel bereik hoort bij de kop, zodat het streepje in "rijen 1-4" niet
 * voor een scheidingsteken wordt aangezien — dat knipte hele zinnen doormidden.
 */
const INLINE_HEADER =
  /(?<=\S)\s+(?=\b(?:toer|toeren|rij|rijen|naald|naalden|row|rows|round|rounds|rnd)\s*\.?\s*\d+(?:\s*(?:[-–—]|t\/m|en|and|&)\s*\d+)?\s*(?:\([^)]*\))?\s*(?::|\s[-–—]\s))/gi

/** Zin binnen een toer die alsnog een herhaling is: "... Herhaal toer 1-2 nog 4 keer." */
const TRAILING_REPEAT = /(?:^|(?<=[.;]\s))(herhaal|repeat)\b[\s\S]*$/i

/** Woorden die verraden dat een regel een instructie is en geen kopje. */
const INSTRUCTION_WORD =
  /\b(?:recht|averecht|brei(?:en|t)?|mva|minder(?:en)?|meerder(?:en)?|afkant(?:en)?|opzetten|zet|sla|steek|steken|naald|toer|rij|knit|purl|bind|cast|work|st|sts|stitch(?:es)?|row|round)\b/i

/** Een vervolgregel van dezelfde toer: begint klein, met een sterretje of met een getal. */
function looksLikeContinuation(line: string): boolean {
  return /^[a-z(*]/.test(line) || /^\d+\s*[a-z]/i.test(line)
}

/** "Brei als volgt:" zegt niets; de kop eromheen soms wel. */
const BOILERPLATE_LEAD_IN =
  /^(?:brei|work|knit)(?:\s+nu|\s+now)?\s+(?:als\s+volgt|as\s+follows)$/i

/** Een staart als ". Brei als volgt" voegt niets toe aan de kop ervoor. */
const LEAD_IN_TAIL =
  /[.,]?\s*(?:brei|work|knit)(?:\s+nu|\s+now)?\s+(?:als\s+volgt|as\s+follows)\s*$/i

/** Boven deze lengte wordt een kop ingekort, en blijft de hele tekst als notitie staan. */
const MAX_SECTION_NAME = 80

function nextMeaningfulLine(lines: string[], from: number): string | null {
  for (let index = from + 1; index < lines.length; index++) {
    if (lines[index] !== '') return lines[index]
  }
  return null
}

function shorten(name: string): string {
  if (name.length <= MAX_SECTION_NAME) return name
  const cut = name.slice(0, MAX_SECTION_NAME)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function headingLooksLikeSection(line: string): boolean {
  if (line.length > 60 || line.length < 2) return false
  // "Kant alle steken af" is een toer, geen onderdeel van het patroon.
  if (INSTRUCTION_WORD.test(line)) return false
  if (/[.!?;,]$/.test(line)) return false
  if (/\d/.test(line) && !/^[A-ZÀ-Þ\s-]+$/.test(line)) return false
  const words = line.split(/\s+/)
  if (words.length > 6) return false
  const isUpper = line === line.toUpperCase() && /[A-ZÀ-Þ]/.test(line)
  const isTitle = /^[A-ZÀ-Þ]/.test(line)
  return isUpper || isTitle
}

function parseRowHeader(line: string) {
  const match = ROW_HEADER.exec(line) ?? ROW_HEADER_SHORT.exec(line)
  if (!match) return null

  const [, first, second, parenthetical, rest] = match
  const paren = parenthetical?.trim() ?? ''
  const side = paren ? detectSide(paren) : null
  // Haakjes die geen kant aanduiden horen bij de instructie — daar kan een
  // stekenaantal in staan dat we anders kwijt zijn.
  const body = side === null && paren ? `(${paren}) ${rest ?? ''}`.trim() : (rest ?? '').trim()

  return {
    from: Number(first),
    to: second ? Number(second) : null,
    side: side ?? detectSide(body),
    body,
  }
}

/** Splitst genormaliseerde patroontekst op in blokken in leesvolgorde. */
export function segment(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text
    .split('\n')
    // Een herhaalzin blijft heel: daar staan toernummers in die geen kop zijn.
    .flatMap((line) => (isRepeatLine(line) ? [line] : line.split(INLINE_HEADER)))
    .map((line) => line.trim())

  // Alleen een toerblok loopt door over meerdere regels; losse tekst niet, anders
  // plakt een hele inleiding aan elkaar tot één stap.
  let open: { parts: string[]; header: NonNullable<ReturnType<typeof parseRowHeader>> } | null = null

  const flush = () => {
    if (!open) return
    pushRow(blocks, open.header, open.parts.join(' ').trim())
    open = null
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

    if (line === '') {
      flush()
      continue
    }

    // Een regel die op een dubbele punt eindigt en waar de rijen direct onder
    // staan is een kop, nooit een herhaling — ook niet als er "elke 4e rij" in
    // staat. Die beschrijft juist het blok dat volgt.
    const next = nextMeaningfulLine(lines, index)
    if (line.endsWith(':') && next !== null && looksLikeRowHeader(next)) {
      flush()
      pushLeadIn(blocks, line)
      continue
    }

    if (isRepeatLine(line)) {
      flush()
      blocks.push({ kind: 'repeat', raw: line })
      continue
    }

    const header = parseRowHeader(line)
    if (header) {
      flush()
      open = { parts: [header.body], header }
      continue
    }

    // Alleen een duidelijk vervolg hoort nog bij de vorige toer. normalize heeft
    // doorlopende zinnen al samengevoegd, dus een regel met een hoofdletter is
    // iets nieuws — bijvoorbeeld "Kant alle steken af."
    if (open && looksLikeContinuation(line)) {
      open.parts.push(line)
      continue
    }
    flush()

    if (headingLooksLikeSection(line)) {
      blocks.push({ kind: 'section', name: line.replace(/[:：]$/, '').trim(), raw: line })
      continue
    }

    blocks.push({ kind: 'text', raw: line })
  }
  flush()

  return blocks
}

/**
 * Verwerkt een kopregel. Staat er uitleg voor de kop in dezelfde regel, dan
 * wordt die als losse tekst bewaard: daar staat vaak iets wat je moet weten.
 */
function pushLeadIn(blocks: Block[], line: string) {
  const sentences = line.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean)
  const leadIn = sentences[sentences.length - 1] ?? line
  const before = sentences.slice(0, -1).join(' ')

  if (before !== '') blocks.push({ kind: 'text', raw: before, explanatory: true })

  let name = leadIn.replace(/:$/, '').replace(LEAD_IN_TAIL, '').trim()

  // "Brei nu meerderingen in elke rij. Brei als volgt:" — de kop zit in de zin
  // ervoor, niet in het nietszeggende staartje.
  if ((name === '' || BOILERPLATE_LEAD_IN.test(name)) && before !== '') {
    const earlier = sentences[sentences.length - 2] ?? ''
    name = earlier.replace(/[.:]$/, '').trim()
    blocks.pop()
    const rest = sentences.slice(0, -2).join(' ')
    if (rest !== '') blocks.push({ kind: 'text', raw: rest, explanatory: true })
  }

  if (name === '' || BOILERPLATE_LEAD_IN.test(name)) return

  // Een lange kop wordt ingekort, maar de hele zin blijft als notitie bewaard.
  if (name.length > MAX_SECTION_NAME) blocks.push({ kind: 'text', raw: leadIn, explanatory: true })
  blocks.push({ kind: 'section', name: shorten(name), raw: line })
}

/** Voegt een toerblok toe en haalt er een eventuele herhaalzin achteraan vanaf. */
function pushRow(
  blocks: Block[],
  header: NonNullable<ReturnType<typeof parseRowHeader>>,
  body: string,
) {
  let instruction = body
  let repeat: string | null = null

  const trailing = TRAILING_REPEAT.exec(body)
  if (trailing && trailing.index > 0) {
    instruction = body.slice(0, trailing.index).trim().replace(/[.;,\s]+$/, '')
    repeat = trailing[0].trim()
  }

  blocks.push({
    kind: 'row',
    from: header.from,
    to: header.to,
    side: header.side ?? detectSide(instruction),
    body: instruction,
    raw: instruction,
  })

  if (repeat) blocks.push({ kind: 'repeat', raw: repeat })
}
