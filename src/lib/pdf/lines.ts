/**
 * pdf.js levert losse stukjes tekst met coördinaten, geen regels. Zonder deze
 * stap plakken toernummers aan hun instructie vast en is het patroon onleesbaar.
 *
 * Staat los van pdf.js zelf, zodat het zonder PDF te testen is.
 */

export type Fragment = {
  text: string
  /** Linkerkant van het stukje tekst. */
  x: number
  /** Grondlijn; stukjes op dezelfde grondlijn horen op dezelfde regel. */
  y: number
  /** Letterhoogte, bepaalt hoe groot een gat moet zijn om een spatie te zijn. */
  size: number
  /** Rechterkant van het stukje tekst. */
  endX: number
}

/** Boven dit deel van de letterhoogte horen twee stukjes niet meer op dezelfde regel. */
const LINE_TOLERANCE = 0.6

/** Een gat breder dan dit deel van de letterhoogte is een spatie. */
const SPACE_RATIO = 0.22

/** Eén spatie inspringing per zoveel punten in de PDF. */
const INDENT_UNIT = 4
const MAX_INDENT = 40

/**
 * De tekst van de pagina, met de inspringing van elke regel bewaard als spaties
 * ervoor. Daarmee kan de volgende stap zien of een regel het vervolg is van de
 * vorige (die springt in) of een nieuw item (die staat weer in de kantlijn).
 */
export function fragmentsToLines(fragments: Fragment[]): string[] {
  const sorted = [...fragments].sort((a, b) => b.y - a.y || a.x - b.x)
  const left = Math.min(...fragments.map((fragment) => fragment.x))
  const lines: Fragment[][] = []

  for (const fragment of sorted) {
    const current = lines[lines.length - 1]
    const reference = current?.[0]
    const tolerance = Math.max(1, (reference?.size ?? fragment.size) * LINE_TOLERANCE)

    if (reference && Math.abs(reference.y - fragment.y) <= tolerance) {
      current.push(fragment)
    } else {
      lines.push([fragment])
    }
  }

  return lines.map((line) => {
    const start = Math.min(...line.map((fragment) => fragment.x))
    const indent = Math.min(MAX_INDENT, Math.max(0, Math.round((start - left) / INDENT_UNIT)))
    return ' '.repeat(indent) + joinLine(line)
  })
}

/**
 * Zet de stukjes van één regel naast elkaar. Een patroon zet het rijnummer links
 * en de instructie ver daarnaast; dat wordt één regel met één spatie ertussen,
 * niet een rij spaties.
 */
function joinLine(line: Fragment[]): string {
  const ordered = [...line].sort((a, b) => a.x - b.x)
  let text = ''
  let previous: Fragment | null = null

  for (const fragment of ordered) {
    if (previous) {
      const gap = fragment.x - previous.endX
      const needsSpace = gap > previous.size * SPACE_RATIO
      if (needsSpace && !/\s$/.test(text) && !/^\s/.test(fragment.text)) text += ' '
    }
    text += fragment.text
    previous = fragment
  }

  return text.replace(/\s+/g, ' ').trim()
}
