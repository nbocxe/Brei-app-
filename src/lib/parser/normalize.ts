/**
 * Maakt ruwe PDF-tekst leesbaar voor de parser: rare tekens opruimen,
 * pagina-opsmuk weghalen en afgebroken woorden en regels weer aan elkaar zetten.
 */

const REPLACEMENTS: [RegExp, string][] = [
  [/­/g, ''], // zacht afbreekstreepje
  [/ﬁ/g, 'fi'],
  [/ﬂ/g, 'fl'],
  [/[‘’‛]/g, "'"],
  [/[“”]/g, '"'],
  [/…/g, '...'],
  [/[   ]/g, ' '],
  [/[‐‑‒]/g, '-'],
  [/×/g, 'x'],
  [/⇒/g, '→'],
  [/•|●|▪|■/g, '-'], // opsommingsbolletjes
]

const PAGE_NUMBER =
  /^\s*(?:pagina|page|pag\.?|blz\.?)?\s*\d+\s*(?:\/|van|of)?\s*\d*\s*$/i

/** Hoeveel regels boven- en onderaan een pagina als kop- of voettekst kunnen gelden. */
const EDGE = 2

/**
 * Kop- en voetteksten weghalen: regels die op meerdere pagina's op dezelfde
 * plek terugkomen. Alleen de randen van een pagina worden bekeken, zodat een
 * instructie die toevallig vaker voorkomt ("Averecht.") blijft staan.
 */
function stripRunningHeaders(pages: string[][]): string[][] {
  if (pages.length < 2) return pages

  const edgeCounts = new Map<string, number>()
  for (const page of pages) {
    const edges = new Set([...page.slice(0, EDGE), ...page.slice(-EDGE)])
    for (const line of edges) {
      const key = line.trim().toLowerCase()
      if (key.length < 3 || key.length > 80) continue
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
    }
  }

  const threshold = Math.max(2, Math.ceil(pages.length / 2))
  const isFurniture = (line: string, index: number, total: number) => {
    if (index >= EDGE && index < total - EDGE) return false
    const key = line.trim().toLowerCase()
    return (edgeCounts.get(key) ?? 0) >= threshold
  }

  return pages.map((page) =>
    page.filter((line, index) => !isFurniture(line, index, page.length)),
  )
}

/** De inspringing blijft staan: die zegt of een regel het vervolg is van de vorige. */
function cleanLines(text: string): string[] {
  let cleaned = text.normalize('NFKC')
  for (const [pattern, value] of REPLACEMENTS) cleaned = cleaned.replace(pattern, value)
  return cleaned.split(/\r?\n/).map((line) => {
    const indent = /^[ \t]*/.exec(line)?.[0].length ?? 0
    const body = line.slice(indent).replace(/[ \t]+/g, ' ').trimEnd()
    return body === '' ? '' : ' '.repeat(indent) + body
  })
}

function indentOf(line: string): number {
  return /^ */.exec(line)?.[0].length ?? 0
}

/**
 * Vanaf de afkortingenlijst is elke regel een eigen item, hoe kort ook. Daar mag
 * "GK goede kant van het werk" niet aan "mdv met de draad voor het werk" vastplakken.
 */
const GLOSSARY_HEADING = /^(?:afkortingen|afkorting|abbreviations?|legenda)$/i

/** Regels die duidelijk een nieuw item beginnen mogen niet aangeplakt worden. */
function isListStart(line: string): boolean {
  return /^(?:[-*]\s|\d+[.)]\s)/.test(line)
}

/**
 * @param input Hele tekst, of de pagina's apart — met pagina's kan de
 *              kop- en voettekstherkenning veel preciezer werken.
 */
export function normalize(input: string | string[]): string {
  const pages = (Array.isArray(input) ? input : [input]).map(cleanLines)
  const lines = stripRunningHeaders(pages)
    .flat()
    .filter((line) => !PAGE_NUMBER.test(line))

  // Zonder inspringing (geplakte tekst) valt er niets uit de opmaak af te leiden
  // en moet het op de zin zelf.
  const hasIndents = lines.some((line) => indentOf(line) > 0)

  const joined: string[] = []
  /** Inspringing van de regel waar het huidige blok mee begon. */
  let blockIndent = 0
  let inGlossary = false

  for (const line of lines) {
    const previous = joined[joined.length - 1]
    const indent = indentOf(line)
    const body = line.trim()

    if (body === '') {
      if (joined.length > 0 && previous !== '') joined.push('')
      blockIndent = 0
      continue
    }

    // Woord dat met een koppelteken over de regel heen is afgebroken.
    if (previous && /[a-z]-$/.test(previous) && /^[a-z]/.test(body)) {
      joined[joined.length - 1] = previous.slice(0, -1) + body
      continue
    }

    // Een zin die midden in de regel ophoudt loopt door op de volgende regel.
    const unfinished =
      !/[.:;!?]$/.test(previous ?? '') && /^[a-z(]/.test(body) && !isListStart(body)

    // Springt de regel verder in dan waar het blok begon, dan hoort hij sowieso
    // bij de regel ervoor — zo worden instructie en vervolgregel weer één.
    const hanging = hasIndents && indent > blockIndent

    const continues = inGlossary ? hanging : hanging || unfinished

    if (previous && previous !== '' && continues) {
      joined[joined.length - 1] = `${previous} ${body}`
      continue
    }

    if (GLOSSARY_HEADING.test(body)) inGlossary = true

    joined.push(body)
    blockIndent = indent
  }

  return joined.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
