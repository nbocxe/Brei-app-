import type { GlossaryEntry } from './types'

/** De kop waaronder een patroon zijn afkortingen uitlegt. */
export const GLOSSARY_HEADING = /^(?:afkortingen|afkorting|abbreviations?|legenda)$/i

/** Kopjes van de patroongegevens, die er net zo uitzien maar geen afkorting zijn. */
const METADATA_KEY =
  /^(?:maten?|naalden?|garen|materialen|lengte|diepte|breedte|hoogte|stekenverhouding|spanning|patroon|sizes?|needles?|yarn|gauge|materials|tension|pattern|notes?)$/i

/** "Mva: Meerder voor en achter; brei eerst in de voorste draad..." */
const COLON_ENTRY = /^([\p{L}\p{N}()/.]{1,8}):\s+(.{5,})$/u

/** "aro haal 1 steek recht af, 1r, ..." — in de afkortingenlijst zonder dubbele punt. */
const SPACED_ENTRY = /^([\p{L}\p{N}()/.]{1,8})\s+(.{5,})$/u

/**
 * Een afkorting ziet eruit als een afkorting: helemaal klein, helemaal groot,
 * of met een cijfer erin. Zo blijft een naam als "Mette Wendelboe Okkels" buiten
 * de lijst, die anders zou meeliften op de regels onder de afkortingen.
 */
function looksLikeAbbreviation(term: string): boolean {
  // Een kaal getal is een maat uit de tekening, geen afkorting.
  if (/^\d+$/.test(term)) return false
  if (/\d/.test(term)) return true
  return term === term.toLowerCase() || term === term.toUpperCase()
}

/** Een uitleg bij een afkorting is één zin; langer is lopende tekst. */
const MAX_MEANING = 120

/**
 * Leest één regel als afkorting met uitleg.
 * @param insideGlossary of de regel onder de kop "Afkortingen" staat; daar mag
 *                       de uitleg ook zonder dubbele punt achter de term staan.
 */
export function readGlossaryEntry(line: string, insideGlossary: boolean): GlossaryEntry | null {
  const colon = COLON_ENTRY.exec(line)
  if (colon) {
    const term = colon[1].trim()
    if (METADATA_KEY.test(term)) return null
    return { term, meaning: colon[2].trim() }
  }

  if (!insideGlossary) return null

  const spaced = SPACED_ENTRY.exec(line)
  if (!spaced) return null
  const term = spaced[1].trim()
  const meaning = spaced[2].trim()
  if (METADATA_KEY.test(term) || !looksLikeAbbreviation(term)) return null
  if (meaning.length > MAX_MEANING) return null
  return { term, meaning }
}
