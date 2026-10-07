import { GLOSSARY_HEADING, readGlossaryEntry } from './glossary'
import { detectLanguage } from './lexicon'
import { normalize } from './normalize'
import { parseBlockContent, type BlockContent } from './parseBlock'
import { extraRuns, isAmbiguousCount, parseRepeat, splitRepeats, type RepeatSpec } from './repeats'
import { segment } from './segment'
import { applySize, type SizeSet } from './sizes'
import type {
  Counter,
  GlossaryEntry,
  Lang,
  ParseResult,
  Row,
  RowKind,
  Section,
  Side,
} from './types'

/** Grenzen tegen patronen die per ongeluk duizenden toeren zouden opleveren. */
const MAX_RUNS = 400
const MAX_ROWS = 3000

/** Een zin die je iets opdraagt, in plaats van iets uitlegt. */
const IMPERATIVE =
  /^(?:zet|sla|brei(?:t|en)?|naai|hecht|kant|haal|plaats|knip|verbind|meerder|minder|herhaal|werk|maak|begin|cast|knit|purl|work|bind|sew|weave|place|slip|repeat)\b/i

/**
 * "Naalden: 4 mm", "Stekenverhouding: 17 stn x 30 rijen" — de gegevens boven het
 * patroon. Die horen bij de aantekeningen, niet tussen de toeren.
 */
const METADATA_LINE = /^[^:\d]{2,30}:\s/

/** Tekst die over het breiwerk zelf gaat, en dus de moeite van het lezen waard is. */
const KNITTING =
  /\b(?:ge?brei(?:d|en|t|de)?|recht|averecht|mva|minder(?:en|ing(?:en)?)?|meerder(?:en|ing(?:en)?)?|afkant(?:en)?|opzetten|naai(?:en|t)?|genaaid|hecht(?:en)?|steek|steken|stn|rij|rijen|toer|toeren|naald|naalden|knit|purl|bind\s+off|cast\s+(?:on|off)|stitch(?:es)?|row|round|sew|seam|weave)\b/i

/** "Brei zo door zoals beschreven tot er 45 stn op de naald staan." */
const AS_DESCRIBED =
  /\b(?:zoals\s+(?:beschreven|aangegeven|hierboven|eerder)|as\s+(?:described|established|set|before))\b/i
const UNTIL = /\b(?:tot(?:dat)?|until)\b/i
const UNTIL_STITCHES =
  /\b(?:tot(?:dat)?|until)\b[^.]{0,80}?(\d+)\s*(?:st\.?|sts\.?|stn\.?|steken|stitches)/i

/** "Brei als rij 2" — een verwijzing naar een eerdere rij in hetzelfde blok. */
const CROSS_REF =
  /^(?:brei|werk|work|knit|rep(?:eat)?)\s+(?:het\s+|de\s+)?(?:als|as|like)\s+(?:rij|toer|naald|row|round)\s*\.?\s*(\d+)\b/i

/** "De volgende rij is een VK-rij." — het patroon zet je kant hiermee recht. */
const NEXT_SIDE = /\bvolgende\s+(?:rij|toer|naald)\s+is\s+een\s+(GK|VK)\b/i

/** Rondbreien kent geen goede en verkeerde kant. */
const IN_THE_ROUND = /\b(?:rondbreien|in\s+de\s+rondte|rondgebreid|in\s+the\s+round|magic\s+loop)\b/i

type Emitted = { row: Row; content: BlockContent; declared: number | null }

type EmitOptions = {
  content: BlockContent
  kind?: RowKind
  declaredNumber?: number | null
  /** Bij herhalingen telt de app zelf door in plaats van het patroon te geloven. */
  forceDerived?: boolean
  label?: string
  patternLabel?: string | null
  needsCheck?: boolean
  note?: string
  counter?: Counter | null
}

const texts = {
  nl: {
    castOn: 'Opzetten',
    plain: 'Gewoon doorbreien',
    step: 'Stap',
    note: 'Toelichting',
    repeatUntil: 'Herhalen',
  },
  en: {
    castOn: 'Cast on',
    plain: 'Work even',
    step: 'Step',
    note: 'Note',
    repeatUntil: 'Repeat',
  },
} satisfies Record<Lang, Record<string, string>>

/** Het patroon noemt het rij of toer; dat woord gebruiken we ook in de lijst. */
function rowWordOf(text: string, lang: Lang): string {
  if (lang === 'en') {
    const rows = (text.match(/\brows?\b/gi) ?? []).length
    const rounds = (text.match(/\brounds?\b/gi) ?? []).length
    return rounds > rows ? 'Round' : 'Row'
  }
  const rij = (text.match(/\brij(?:en)?\b/gi) ?? []).length
  const toer = (text.match(/\btoer(?:en)?\b/gi) ?? []).length
  return rij > toer ? 'Rij' : 'Toer'
}

export type ParseOptions = {
  /** De maten uit het patroon; weglaten laat alle maatgetallen staan. */
  sizes?: SizeSet | null
  /** Welke maat je breit. */
  sizeIndex?: number
}

/**
 * Leest een breipatroon en schrijft het uit tot een lijst afvinkbare toeren.
 *
 * Geef de pagina's zoals ze uit de PDF komen: het opschonen gebeurt hier, in één
 * keer. Twee keer opschonen zou de inspringing kwijtraken waar de indeling aan
 * af te lezen is.
 */
export function parsePattern(input: string | string[], options: ParseOptions = {}): ParseResult {
  const cleaned = normalize(input)
  const { sizes = null, sizeIndex = 0 } = options
  const text = sizes ? applySize(cleaned, sizes, sizeIndex).text : cleaned
  const lang = detectLanguage(text)
  const t = texts[lang]
  const rowWord = rowWordOf(text, lang)
  const assignSides = !IN_THE_ROUND.test(text)

  const rows: Row[] = []
  const emitted: Emitted[] = []
  const sections: Section[] = []
  const glossary: GlossaryEntry[] = []
  const leftovers: string[] = []
  const warnings: string[] = []

  let lastSide: Side = null
  /** Het patroon kan de kant van de volgende rij voorschrijven. */
  let forcedSide: Side = null
  let stitches: number | null = null
  let stitchesDerived = false
  let sectionId: string | null = null
  let pendingSection: Section | null = null
  let insideGlossary = false
  let globalRow = 0
  let fromRepeats = 0
  let ids = 0

  /** Vanaf welke regel het blok loopt waar verwijzingen in gezocht worden. */
  let blockStart = 0
  /** De rijen van het laatst beschreven blok, voor een open herhaling. */
  let currentDefinition: BlockContent[] = []
  let lastDefinition: BlockContent[] = []

  function resolveSide(declared: Side): Side {
    if (!assignSides) return declared
    if (declared) return declared
    if (forcedSide) return forcedSide
    if (lastSide) return lastSide === 'GK' ? 'VK' : 'GK'
    return 'GK'
  }

  function takePendingSection(): Section | null {
    const section = pendingSection
    pendingSection = null
    return section
  }

  function emitRow(options: EmitOptions): Row | null {
    if (rows.length >= MAX_ROWS) return null

    const { content, kind = 'row', forceDerived = false } = options
    const opening = takePendingSection()
    if (opening) sections.push(opening)

    // Alleen echte toeren tellen mee voor de nummering en de kantwisseling;
    // een toelichting ertussen mag die rij niet verschuiven.
    const numbered = kind === 'row'
    const rowNumber = numbered ? ++globalRow : null

    let side: Side = null
    if (numbered) {
      side = resolveSide(content.side)
      if (side) lastSide = side
      forcedSide = null
    }

    if (kind !== 'note') {
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
    }

    const row: Row = {
      id: `r${++ids}`,
      kind,
      label: options.label ?? (rowNumber !== null ? `${rowWord} ${rowNumber}` : t.step),
      patternLabel: options.patternLabel ?? null,
      rowNumber,
      instruction: content.instruction,
      sourceRef: content.sourceRef,
      side,
      stitches: kind === 'note' ? null : stitches,
      stitchesDerived: kind === 'note' ? false : stitchesDerived,
      sectionId,
      needsCheck: options.needsCheck ?? false,
      note: options.note ?? '',
      counter: options.counter ?? null,
      done: false,
    }

    rows.push(row)
    emitted.push({ row, content, declared: options.declaredNumber ?? null })
    return row
  }

  function addSection(name: string) {
    // In de afkortingenlijst ziet elke regel eruit als een kopje ("VK verkeerde
    // kant van het werk"). Daar is het een afkorting met uitleg.
    if (insideGlossary) {
      const entry = readGlossaryEntry(name, true)
      if (entry) {
        glossary.push(entry)
        return
      }
    }

    insideGlossary = GLOSSARY_HEADING.test(name)
    const existing = sections.find((section) => section.name === name)
    if (existing) {
      sectionId = existing.id
      pendingSection = null
      return
    }
    // Komt er geen toer meer onder, dan was het de titel van het patroon en
    // niet een onderdeel. Daarom pas vastleggen bij de eerste toer.
    pendingSection = { id: `s${sections.length + 1}`, name }
    sectionId = pendingSection.id
  }

  /** "Brei als rij 2" invullen met wat rij 2 zegt, gezocht in hetzelfde blok. */
  function resolveCrossRef(content: BlockContent): BlockContent {
    const match = CROSS_REF.exec(content.instruction.trim())
    if (!match) return content

    const wanted = Number(match[1])
    const source = emitted
      .slice(blockStart)
      .reverse()
      .find((item) => item.declared === wanted)
    if (!source) return content

    return {
      ...source.content,
      // De rij houdt zijn eigen naam en kant; alleen de instructie komt van elders.
      patternLabel: content.patternLabel,
      side: content.side ?? source.content.side,
      sourceRef: content.instruction.trim(),
    }
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
        kind: 'step',
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
          patternLabel: content.patternLabel,
          needsCheck: first && note !== '',
          note: first ? note : '',
        })
        if (!row) return
        fromRepeats += 1
        first = false
      }
    }
  }

  /** "Brei zo door tot er 45 stn op de naald staan" — jij bepaalt hoe vaak. */
  function handleRepeatUntil(raw: string) {
    const target = UNTIL_STITCHES.exec(raw)
    const perRepeat = lastDefinition.reduce((sum, source) => sum + source.delta, 0)
    const counter: Counter = {
      done: 0,
      perRepeat,
      from: stitches,
      target: target ? Number(target[1]) : null,
    }

    emitRow({
      content: parseBlockContent(raw),
      kind: 'repeat-until',
      label: t.repeatUntil,
      counter,
      note:
        'Hoe vaak dit moet hangt af van je werk. Houd het bij met de teller en ga verder ' +
        'zodra het klopt.',
    })

    // Daarna ben je op het aantal uit het patroon; de volgende toeren rekenen daarmee.
    if (counter.target !== null) {
      stitches = counter.target
      stitchesDerived = true
    }
  }

  /** Losse tekst: opdracht, uitleg, afkorting of open herhaling. */
  function handleText(raw: string, explanatory = false) {
    const entry = readGlossaryEntry(raw, insideGlossary)
    if (entry) {
      glossary.push(entry)
      return
    }

    const content = parseBlockContent(raw)

    if (content.castOn !== null) {
      emitRow({ content, kind: 'step', label: t.castOn })
      return
    }

    if (AS_DESCRIBED.test(raw) && UNTIL.test(raw)) {
      handleRepeatUntil(raw)
      return
    }

    if (IMPERATIVE.test(raw) && !explanatory) {
      emitRow({ content, kind: 'step' })
      return
    }

    // Geen opdracht, maar wel over het breiwerk: uitleg die je leest en niet afvinkt.
    if (explanatory || (!METADATA_LINE.test(raw) && KNITTING.test(raw))) {
      emitRow({ content, kind: 'note', label: t.note })
      return
    }

    // Gegevens en kleine lettertjes horen bij de aantekeningen van het project.
    leftovers.push(raw)
  }

  for (const block of segment(text)) {
    if (block.kind !== 'row') {
      // Een blok rijen is afgelopen; verwijzingen zoeken voortaan in het nieuwe blok.
      if (currentDefinition.length > 0) {
        lastDefinition = currentDefinition
        currentDefinition = []
      }
      blockStart = emitted.length
    }

    if (block.kind === 'section') {
      addSection(block.name)
      continue
    }

    if (block.kind === 'repeat') {
      // "Brei rijen 1-4 eenmaal, brei dan rijen 3 en 4 nog 1 maal" is er twee.
      for (const part of splitRepeats(block.raw)) handleRepeat(part)
      continue
    }

    if (block.kind === 'text') {
      handleText(block.raw, block.explanatory === true)
      const side = NEXT_SIDE.exec(block.raw)
      if (side) forcedSide = side[1].toUpperCase() as Side
      continue
    }

    const parsed = parseBlockContent(block.body, block.side)
    const from = block.from ?? 1
    const to = Math.min(block.to ?? from, from + MAX_RUNS)
    for (let number = from; number <= to; number++) {
      const content = resolveCrossRef({
        ...parsed,
        patternLabel: `${rowWord} ${number}${parsed.side ? ` (${parsed.side})` : ''}`,
      })
      currentDefinition.push(content)
      emitRow({ content, declaredNumber: number, patternLabel: content.patternLabel })
    }
  }

  if (currentDefinition.length > 0) lastDefinition = currentDefinition

  // Een kop waar nooit een toer onder kwam gaat niet verloren.
  const unusedSection = takePendingSection()
  if (unusedSection) leftovers.push(unusedSection.name)

  // Eén onderdeel dat het hele patroon beslaat verdeelt niets: dat was de titel.
  if (sections.length === 1 && rows.every((row) => row.sectionId === sections[0].id)) {
    sections.length = 0
    for (const row of rows) row.sectionId = null
  }

  if (rows.length >= MAX_ROWS) {
    warnings.push(`Het patroon leverde meer dan ${MAX_ROWS} toeren op en is afgekapt.`)
  }

  return {
    rows,
    sections,
    glossary,
    lang,
    sizes,
    sizeIndex: sizes ? sizeIndex : 0,
    text,
    leftovers,
    warnings,
    stats: {
      fromRepeats,
      needsCheck: rows.filter((row) => row.needsCheck).length,
    },
  }
}
