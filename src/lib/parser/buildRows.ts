import { detectLanguage } from './lexicon'
import { normalize } from './normalize'
import { parseBlockContent, type BlockContent } from './parseBlock'
import { extraRuns, isAmbiguousCount, parseRepeat, type RepeatSpec } from './repeats'
import { segment } from './segment'
import type { Lang, ParseResult, Row, Section, Side } from './types'

/** Grenzen tegen patronen die per ongeluk duizenden toeren zouden opleveren. */
const MAX_RUNS = 400
const MAX_ROWS = 3000

/** Tekst die duidelijk een breihandeling beschrijft, ook zonder toernummer. */
const ACTION =
  /\b(?:recht|averecht|brei(?:en|t)?|mva|minder(?:en)?|meerder(?:en)?|afkant(?:en)?|opzetten|zet\s+\d+|knit|purl|bind\s+off|cast\s+on|k2tog|ssk|work)\b/i

/** Rondbreien kent geen goede en verkeerde kant. */
const IN_THE_ROUND = /\b(?:rondbreien|in\s+de\s+rondte|rondgebreid|in\s+the\s+round|magic\s+loop)\b/i

type Emitted = { row: Row; content: BlockContent; declared: number | null }

type EmitOptions = {
  content: BlockContent
  declaredNumber?: number | null
  /** Bij herhalingen telt de app zelf door in plaats van het patroon te geloven. */
  forceDerived?: boolean
  numbered?: boolean
  label?: string
  needsCheck?: boolean
  note?: string
}

const texts = {
  nl: { row: 'Toer', castOn: 'Opzetten', plain: 'Gewoon doorbreien', step: 'Stap' },
  en: { row: 'Row', castOn: 'Cast on', plain: 'Work even', step: 'Step' },
} satisfies Record<Lang, Record<string, string>>

/** Leest een breipatroon en schrijft het uit tot een lijst afvinkbare toeren. */
export function parsePattern(input: string | string[]): ParseResult {
  const text = normalize(input)
  const lang = detectLanguage(text)
  const t = texts[lang]
  const assignSides = !IN_THE_ROUND.test(text)

  const rows: Row[] = []
  const emitted: Emitted[] = []
  const sections: Section[] = []
  const leftovers: string[] = []
  const warnings: string[] = []

  let nextRowNumber = 1
  let lastSide: Side = null
  let stitches: number | null = null
  let stitchesDerived = false
  let sectionId: string | null = null
  let fromRepeats = 0
  let ids = 0

  function resolveSide(declared: Side, rowNumber: number | null): Side {
    if (!assignSides) return declared
    if (declared) return declared
    if (lastSide) return lastSide === 'GK' ? 'VK' : 'GK'
    if (rowNumber !== null) return rowNumber % 2 === 1 ? 'GK' : 'VK'
    return null
  }

  function emitRow(options: EmitOptions): Row | null {
    if (rows.length >= MAX_ROWS) return null

    const { content, forceDerived = false, numbered = true } = options
    const rowNumber = numbered ? (options.declaredNumber ?? nextRowNumber) : null
    if (rowNumber !== null) nextRowNumber = rowNumber + 1

    const side = resolveSide(content.side, rowNumber)
    if (side) lastSide = side

    if (content.castOn !== null) {
      stitches = content.castOn
      stitchesDerived = false
    } else if (!forceDerived && content.stitches !== null) {
      stitches = content.stitches
      stitchesDerived = false
    } else if (content.uncertainStitches) {
      // Beter geen getal dan een getal dat stilletjes afdrijft.
      stitches = null
      stitchesDerived = false
    } else if (stitches !== null && content.delta !== 0) {
      stitches += content.delta
      stitchesDerived = true
    }

    const row: Row = {
      id: `r${++ids}`,
      label: options.label ?? (rowNumber !== null ? `${t.row} ${rowNumber}` : t.step),
      rowNumber,
      instruction: content.instruction,
      side,
      stitches,
      stitchesDerived,
      sectionId,
      needsCheck: options.needsCheck ?? false,
      note: options.note ?? '',
      done: false,
    }

    rows.push(row)
    emitted.push({ row, content, declared: options.declaredNumber ?? null })
    return row
  }

  function addSection(name: string) {
    const existing = sections.find((section) => section.name === name)
    if (existing) {
      sectionId = existing.id
      return
    }
    const section = { id: `s${sections.length + 1}`, name }
    sections.push(section)
    sectionId = section.id
  }

  /** De toeren waar een herhaalinstructie naar verwijst. */
  function sourcesFor(spec: RepeatSpec): BlockContent[] {
    if (spec.kind === 'rows') {
      const found: BlockContent[] = []
      for (let number = spec.from; number <= spec.to; number++) {
        // Achterstevoren zoeken: bij een patroon dat per onderdeel opnieuw
        // nummert hoort de herhaling bij het laatste blok met dat nummer.
        const match = [...emitted].reverse().find((item) => item.declared === number)
        if (match) found.push(match.content)
      }
      return found
    }
    if (spec.kind === 'last') {
      return emitted.slice(-spec.count).map((item) => item.content)
    }
    if (spec.kind === 'interval') {
      const increase = parseBlockContent(spec.text)
      const plain = parseBlockContent(t.plain)
      return [increase, ...Array.from({ length: spec.every - 1 }, () => plain)]
    }
    return []
  }

  /** Hoe vaak het blok nog gebreid wordt, als dat te bepalen is. */
  function runCount(spec: RepeatSpec, sources: BlockContent[]): number | null {
    if (spec.kind === 'unknown') return null

    const direct = spec.kind === 'interval' ? spec.times : extraRuns(spec)
    if (direct !== null) return direct

    if (spec.untilStitches !== null && stitches !== null) {
      const perRun = sources.reduce((sum, source) => sum + source.delta, 0)
      if (perRun !== 0) {
        const runs = Math.ceil((spec.untilStitches - stitches) / perRun)
        if (runs > 0) return runs
      }
    }
    return null
  }

  function handleRepeat(raw: string) {
    const spec = parseRepeat(raw)
    const sources = sourcesFor(spec)

    if (sources.length === 0) {
      emitRow({
        content: parseBlockContent(raw),
        needsCheck: true,
        note: 'Deze herhaling kon niet worden uitgeschreven. Vul zelf aan wat er gebreid wordt.',
      })
      return
    }

    let runs = runCount(spec, sources)
    const notes: string[] = []

    if (runs === null) {
      runs = 1
      notes.push('Niet te lezen hoe vaak dit herhaald wordt — hier staat nu één herhaling.')
    }
    if (runs > MAX_RUNS) {
      warnings.push(`Een herhaling leverde meer dan ${MAX_RUNS} toeren op en is afgekapt.`)
      runs = MAX_RUNS
    }
    if (spec.kind !== 'unknown' && spec.untilStitches !== null && spec.times === null) {
      notes.push(`Uitgeschreven tot ${spec.untilStitches} steken.`)
    }
    if (spec.kind === 'interval') {
      // Bij een interval is "3 keer" eenduidig: drie van deze toeren.
      notes.push(
        `Gelezen als: om de ${spec.every} toeren deze ene toer, met daartussen ` +
          `${spec.every - 1} toeren gewoon doorbreien.`,
      )
    } else if (isAmbiguousCount(raw)) {
      notes.push('Gelezen als extra herhalingen bovenop de eerste keer — controleer dat even.')
    }

    const note = notes.join(' ')
    let first = true
    for (let run = 0; run < runs; run++) {
      for (const content of sources) {
        const row = emitRow({
          content,
          forceDerived: true,
          needsCheck: first && note !== '',
          note: first ? note : '',
        })
        if (!row) return
        fromRepeats += 1
        first = false
      }
    }
  }

  for (const block of segment(text)) {
    if (block.kind === 'section') {
      addSection(block.name)
      continue
    }

    if (block.kind === 'repeat') {
      handleRepeat(block.raw)
      continue
    }

    if (block.kind === 'row') {
      const content = parseBlockContent(block.body, block.side)
      const from = block.from ?? nextRowNumber
      const to = Math.min(block.to ?? from, from + MAX_RUNS)
      for (let number = from; number <= to; number++) {
        emitRow({ content, declaredNumber: number })
      }
      continue
    }

    // Losse tekst: alleen een toer als er echt gebreid wordt.
    const content = parseBlockContent(block.raw)
    if (content.castOn !== null) {
      emitRow({ content, numbered: false, label: t.castOn })
    } else if (ACTION.test(block.raw)) {
      emitRow({
        content,
        numbered: false,
        needsCheck: true,
        note: 'Geen toernummer gevonden — klopt het dat dit een aparte stap is?',
      })
    } else {
      leftovers.push(block.raw)
    }
  }

  if (rows.length >= MAX_ROWS) {
    warnings.push(`Het patroon leverde meer dan ${MAX_ROWS} toeren op en is afgekapt.`)
  }

  return {
    rows,
    sections,
    lang,
    text,
    leftovers,
    warnings,
    stats: {
      fromRepeats,
      needsCheck: rows.filter((row) => row.needsCheck).length,
    },
  }
}
