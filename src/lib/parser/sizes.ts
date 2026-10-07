/**
 * Patronen geven elk getal per maat: "6 (6) 6 stn", "elke 6e (8e) 10e rij",
 * "nog 1 (2) 3 maal". Zolang die groepen in de tekst staan klopt geen enkel
 * aantal. Daarom wordt eerst de maat gekozen en blijft alleen dat getal over.
 */

export type SizeSet = {
  /** De namen van de maten, in de volgorde waarin ze in het patroon staan. */
  names: string[]
  /** Per maat of hij tussen haakjes staat — dat bepaalt de vorm van de getalgroepen. */
  parenthesised: boolean[]
  /** De regel waar dit uit gelezen is, om in het importscherm te tonen. */
  line: string
}

const SIZE_LINE = /^[ \t]*(?:maten|maat|sizes?|size)[ \t]*[:：][ \t]*(.+)$/im

/** Een maatnaam is kort en bevat geen spaties: S, M, XL, 3XL, S/M. */
function isSizeName(value: string): boolean {
  return value.length <= 8 && !/\s/.test(value) && /^[\p{L}\p{N}/+.-]+$/u.test(value)
}

/** Getalvorm binnen een maatgroep: 45, 1,5, 6e, 10de. */
const VALUE = String.raw`\d+(?:[.,]\d+)?(?:e|de|ste)?`

export function detectSizes(text: string): SizeSet | null {
  const match = SIZE_LINE.exec(text)
  if (!match) return null

  const rest = match[1].trim()
  const names: string[] = []
  const parenthesised: boolean[] = []

  for (const token of rest.matchAll(/\(([^)]*)\)|([^()]+)/g)) {
    const inside = token[1]
    const value = (inside ?? token[2] ?? '').trim()
    if (value === '') continue
    // Een lang stuk tekst is geen maat meer, maar een opmerking zoals
    // "(op de foto in maat S)". Daar houdt de opsomming op.
    if (!isSizeName(value)) break
    names.push(value)
    parenthesised.push(inside !== undefined)
  }

  if (names.length >= 2) {
    return { names, parenthesised, line: match[0].trim() }
  }

  // Sommige patronen schrijven "Maten: XS - S - M - L" zonder haakjes.
  const parts = rest
    .split(/\s*[-–—/,]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2 && parts.every(isSizeName)) {
    return { names: parts, parenthesised: parts.map(() => false), line: match[0].trim() }
  }

  return null
}

/**
 * Bouwt de regex voor een getalgroep in dezelfde vorm als de matenregel:
 * "S (M) L" hoort bij "6 (8) 10", "XS (S) M (L) XL" bij "1 (2) 3 (4) 5".
 */
function groupPattern(sizes: SizeSet): RegExp {
  const parts = sizes.parenthesised.map((inside) =>
    inside ? String.raw`\(\s*(${VALUE})\s*\)` : `(${VALUE})`,
  )
  return new RegExp(parts.join(String.raw`\s*`), 'g')
}

export type SizeApplication = {
  text: string
  /** Hoeveel getalgroepen zijn teruggebracht tot één maat. */
  replaced: number
}

/** Houdt alleen de getallen van de gekozen maat over. */
export function applySize(text: string, sizes: SizeSet, index: number): SizeApplication {
  if (index < 0 || index >= sizes.names.length) return { text, replaced: 0 }

  let replaced = 0
  const result = text.replace(groupPattern(sizes), (whole, ...groups) => {
    const value = groups[index]
    if (typeof value !== 'string') return whole
    replaced += 1
    return value
  })

  return { text: result, replaced }
}
