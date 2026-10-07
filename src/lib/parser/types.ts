/** Goede kant / verkeerde kant van het werk (Engels: RS/WS). */
export type Side = 'GK' | 'VK' | null

export type Lang = 'nl' | 'en'

/** Eén afvinkbare toer. */
export type Row = {
  id: string
  /** Wat in de lijst staat, bijv. "Toer 12". */
  label: string
  /** Toernummer uit het patroon, null als het patroon niet nummert. */
  rowNumber: number | null
  instruction: string
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
  done: boolean
}

export type Section = {
  id: string
  name: string
}

export type ParseResult = {
  rows: Row[]
  sections: Section[]
  lang: Lang
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
  | { kind: 'text'; raw: string }
