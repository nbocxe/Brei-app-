import type { SizeSet } from './sizes'

/** Goede kant / verkeerde kant van het werk (Engels: RS/WS). */
export type Side = 'GK' | 'VK' | null

export type Lang = 'nl' | 'en'

/** Wat voor regel dit is, en of je hem afvinkt. */
export type RowKind =
  /** Een genummerde rij of toer uit het patroon. */
  | 'row'
  /** Een opdracht zonder rijnummer: opzetten, afkanten, samennaaien. */
  | 'step'
  /** Uitleg. Wordt getoond, niet afgevinkt. */
  | 'note'
  /** "Brei zo door tot er 45 steken zijn" — hoe vaak hangt van jou af. */
  | 'repeat-until'

/** De stand van een open herhaling: hoe vaak gedaan, en waar je naartoe werkt. */
export type Counter = {
  done: number
  /** Verandering van het stekenaantal per herhaling. */
  perRepeat: number
  /** Stekenaantal waar je vandaan komt. */
  from: number | null
  /** Stekenaantal waar je naartoe werkt. */
  target: number | null
}

/** Eén regel in de lijst. */
export type Row = {
  id: string
  kind: RowKind
  /** Wat er in de lijst staat, doorlopend genummerd: "Rij 37". */
  label: string
  /** Hoe het patroon deze regel noemt: "Rij 1 (VK)". Blijft staan naast het doorlopende nummer. */
  patternLabel: string | null
  /** Doorlopend nummer over het hele patroon. */
  rowNumber: number | null
  instruction: string
  /** De oorspronkelijke verwijzing, als de instructie is ingevuld: "Brei als rij 2". */
  sourceRef: string | null
  side: Side
  /** Aantal steken ná deze toer. */
  stitches: number | null
  /** True als de app het stekenaantal zelf heeft doorgeteld. */
  stitchesDerived: boolean
  sectionId: string | null
  /** Parser was onzeker: in het reviewscherm oplichten. */
  needsCheck: boolean
  /** Waarom er gecontroleerd moet worden, of een eigen aantekening. */
  note: string
  counter: Counter | null
  done: boolean
}

export type Section = {
  id: string
  name: string
}

/** Een afkorting met de uitleg die het patroon er zelf bij geeft. */
export type GlossaryEntry = {
  term: string
  meaning: string
}

export type ParseResult = {
  rows: Row[]
  sections: Section[]
  glossary: GlossaryEntry[]
  lang: Lang
  /** De maten die in het patroon staan, als die gevonden zijn. */
  sizes: SizeSet | null
  /** Welke maat is toegepast. */
  sizeIndex: number
  /** De opgeschoonde patroontekst waar dit uit is gelezen. */
  text: string
  /** Regels die geen toer bleken: zichtbaar in het reviewscherm, niet weggegooid. */
  leftovers: string[]
  /** Meldingen over het geheel, voor het importscherm. */
  warnings: string[]
  stats: {
    /** Aantal toeren dat uit een herhaalinstructie is uitgeschreven. */
    fromRepeats: number
    needsCheck: number
  }
}

/** Tussenvorm: de tekst opgedeeld in blokken, vóór het uitschrijven. */
export type Block =
  | { kind: 'section'; name: string; raw: string }
  | {
      kind: 'row'
      /** Eerste toernummer in de kop, bijv. 1 bij "Toer 1-2". */
      from: number | null
      /** Laatste toernummer bij een reeks, anders null. */
      to: number | null
      side: Side
      body: string
      raw: string
    }
  | { kind: 'repeat'; raw: string }
  | {
      kind: 'text'
      raw: string
      /** Tekst die hoort bij een kop: uitleg, nooit een stap om af te vinken. */
      explanatory?: boolean
    }
