import { ROW_HEADER, ROW_HEADER_SHORT, detectSide, looksLikeRowHeader } from './lexicon'
import type { Block } from './types'

/** Zinnen die een herhaling aankondigen. */
const REPEAT_START = /^(?:herhaal|repeat|brei\s+toer|work\s+rows?)\b/i

/** "om de 4 toeren", "elke 4e toer", "every 4th row" — een herhaling met een interval. */
const INTERVAL =
  /\b(?:om\s+de\s+\d+\s*(?:e|de|ste)?\s*(?:toer|rij|naald)|elke\s+\d+\s*(?:e|de|ste)\s*(?:toer|rij|naald)|every\s+\d+(?:st|nd|rd|th)?\s+(?:row|round))/i

export function isRepeatLine(line: string): boolean {
  if (looksLikeRowHeader(line)) return false
  return REPEAT_START.test(line) || INTERVAL.test(line)
}

/**
 * Een toerkop midden in een regel, herkenbaar aan het dubbelepunt of streepje
 * erachter. "Herhaal toer 1 en 2" heeft dat niet en wordt dus niet gesplitst.
 */
const INLINE_HEADER =
  /(?<=\S)\s+(?=\b(?:toer|toeren|rij|rijen|naald|naalden|row|rows|round|rounds|rnd)\s*\.?\s*\d+\s*(?:\([^)]*\))?\s*[:–—-])/gi

/** Zin binnen een toer die alsnog een herhaling is: "... Herhaal toer 1-2 nog 4 keer." */
const TRAILING_REPEAT = /(?:^|(?<=[.;]\s))(herhaal|repeat)\b[\s\S]*$/i

function headingLooksLikeSection(line: string): boolean {
  if (line.length > 60 || line.length < 2) return false
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

  let open: { kind: 'row' | 'text'; parts: string[]; header: ReturnType<typeof parseRowHeader> } | null =
    null

  const flush = () => {
    if (!open) return
    const raw = open.parts.join(' ').trim()
    if (raw === '' && !open.header) {
      open = null
      return
    }
    if (open.kind === 'row' && open.header) {
      pushRow(blocks, open.header, raw)
    } else if (raw !== '') {
      blocks.push({ kind: 'text', raw })
    }
    open = null
  }

  for (const line of lines) {
    if (line === '') {
      flush()
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
      open = { kind: 'row', parts: [header.body], header }
      continue
    }

    if (!open && headingLooksLikeSection(line)) {
      blocks.push({ kind: 'section', name: line.replace(/[:：]$/, '').trim(), raw: line })
      continue
    }

    if (open) {
      open.parts.push(line)
    } else {
      open = { kind: 'text', parts: [line], header: null }
    }
  }
  flush()

  return blocks
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
