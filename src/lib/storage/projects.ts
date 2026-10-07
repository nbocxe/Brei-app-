import type { GlossaryEntry, Lang, Row, Section } from '../parser/types'
import type { SizeSet } from '../parser/sizes'

export const ACCENTS = [
  'lavender',
  'lime',
  'lilac',
  'coral',
  'mint',
  'sky',
  'butter',
  'rose',
] as const

export type Accent = (typeof ACCENTS)[number]

export type Project = {
  id: string
  name: string
  accent: Accent
  createdAt: string
  updatedAt: string
  lang: Lang
  sections: Section[]
  rows: Row[]
  /** De afkortingen die het patroon zelf uitlegt. */
  glossary: GlossaryEntry[]
  /** De maten die in het patroon staan, als het patroon die geeft. */
  sizes: SizeSet | null
  /** Welke maat je brijt. */
  sizeIndex: number
  /** De uitgelezen patroontekst, om op terug te kunnen vallen. */
  sourceText: string
  /** De pagina's zoals ze uit de PDF kwamen, om bij een andere maat opnieuw te lezen. */
  sourcePages: string[]
  /** Naalden, garen, spanning — en wat de parser niet als toer herkende. */
  notes: string
}

const STORAGE_KEY = 'knittinerd.projects'
const SCHEMA_VERSION = 1

type Store = { schemaVersion: number; projects: Project[] }

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Valt terug op het geheugen als localStorage niet beschikbaar is (privémodus). */
let memory: Project[] | null = null
let projects: Project[] = []
const listeners = new Set<() => void>()

function readStorage(): Project[] {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Store
    if (!parsed || !Array.isArray(parsed.projects)) return []
    return parsed.projects.map(migrate)
  } catch {
    return []
  }
}

function writeStorage(next: Project[]) {
  projects = next
  const store: Store = { schemaVersion: SCHEMA_VERSION, projects: next }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    memory = null
  } catch {
    // Vol of geblokkeerd: dan maar voor deze sessie in het geheugen.
    memory = next
  }
  for (const listener of listeners) listener()
}

/** Oudere of handmatig aangepaste projecten op het huidige model trekken. */
function migrate(project: Project): Project {
  return {
    ...project,
    accent: ACCENTS.includes(project.accent) ? project.accent : 'lavender',
    sections: project.sections ?? [],
    glossary: project.glossary ?? [],
    sizes: project.sizes ?? null,
    sizeIndex: project.sizeIndex ?? 0,
    notes: project.notes ?? '',
    sourceText: project.sourceText ?? '',
    sourcePages: project.sourcePages ?? [],
    lang: project.lang === 'en' ? 'en' : 'nl',
    rows: (project.rows ?? []).map((row) => ({
      ...row,
      // Projecten van vóór de regelsoorten bestonden alleen uit toeren.
      kind: row.kind ?? 'row',
      patternLabel: row.patternLabel ?? null,
      sourceRef: row.sourceRef ?? null,
      counter: row.counter ?? null,
      done: Boolean(row.done),
      note: row.note ?? '',
      needsCheck: Boolean(row.needsCheck),
    })),
  }
}

projects = readStorage()

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getProjects(): Project[] {
  return projects
}

export function getProject(id: string): Project | undefined {
  return projects.find((project) => project.id === id)
}

/** Kiest een accentkleur die nog niet in gebruik is, zodat kaarten uit elkaar vallen. */
export function nextAccent(): Accent {
  const used = new Set(projects.map((project) => project.accent))
  return ACCENTS.find((accent) => !used.has(accent)) ?? ACCENTS[projects.length % ACCENTS.length]
}

export function saveProject(project: Project): Project {
  const stamped = { ...project, updatedAt: new Date().toISOString() }
  const index = projects.findIndex((item) => item.id === project.id)
  const next = index === -1 ? [stamped, ...projects] : projects.map((item, i) => (i === index ? stamped : item))
  writeStorage(next)
  return stamped
}

export function updateProject(id: string, change: (project: Project) => Project): void {
  const current = getProject(id)
  if (!current) return
  saveProject(change(current))
}

export function removeProject(id: string): void {
  writeStorage(projects.filter((project) => project.id !== id))
}

export function setRowDone(projectId: string, rowId: string, done: boolean): void {
  updateProject(projectId, (project) => ({
    ...project,
    rows: project.rows.map((row) => (row.id === rowId ? { ...row, done } : row)),
  }))
}

/** Alles tot en met deze toer afvinken — handig na een avond doorbreien. */
export function setDoneUpTo(projectId: string, rowId: string): void {
  updateProject(projectId, (project) => {
    const index = project.rows.findIndex((row) => row.id === rowId)
    if (index === -1) return project
    return {
      ...project,
      rows: project.rows.map((row, i) => ({ ...row, done: isCheckable(row) && i <= index })),
    }
  })
}

/** "Ik ben hier": alles ervoor staat af, deze toer en de rest nog niet. */
export function setCurrentRow(projectId: string, rowId: string): void {
  updateProject(projectId, (project) => {
    const index = project.rows.findIndex((row) => row.id === rowId)
    if (index === -1) return project
    return {
      ...project,
      rows: project.rows.map((row, i) => ({ ...row, done: isCheckable(row) && i < index })),
    }
  })
}

export function setRowNote(projectId: string, rowId: string, note: string): void {
  updateProject(projectId, (project) => ({
    ...project,
    rows: project.rows.map((row) => (row.id === rowId ? { ...row, note } : row)),
  }))
}

export function resetProgress(projectId: string): void {
  updateProject(projectId, (project) => ({
    ...project,
    rows: project.rows.map((row) => ({ ...row, done: false })),
  }))
}

/** Een toelichting lees je, je vinkt hem niet af. */
export function isCheckable(row: Row): boolean {
  return row.kind !== 'note'
}

/** De eerste toer die nog niet af is; is alles af, dan de laatste. */
export function currentRowIndex(project: Project): number {
  const index = project.rows.findIndex((row) => isCheckable(row) && !row.done)
  return index === -1 ? Math.max(0, project.rows.length - 1) : index
}

export function progressOf(project: Project): { done: number; total: number; ratio: number } {
  const checkable = project.rows.filter(isCheckable)
  const done = checkable.filter((row) => row.done).length
  const total = checkable.length
  return { done, total, ratio: total === 0 ? 0 : done / total }
}

/** De stand van de teller bij een open herhaling. */
export function setCounter(projectId: string, rowId: string, done: number): void {
  updateProject(projectId, (project) => ({
    ...project,
    rows: project.rows.map((row) =>
      row.id === rowId && row.counter
        ? { ...row, counter: { ...row.counter, done: Math.max(0, done) } }
        : row,
    ),
  }))
}

export function exportProjects(ids?: string[]): string {
  const selected = ids ? projects.filter((project) => ids.includes(project.id)) : projects
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, projects: selected }, null, 2)
}

export type ImportResult = { added: number; replaced: number }

/** Leest een eerder geëxporteerd bestand terug in. */
export function importProjects(json: string): ImportResult {
  const parsed = JSON.parse(json) as Partial<Store>
  if (!parsed || !Array.isArray(parsed.projects)) {
    throw new Error('Dit bestand bevat geen Knittinerd-projecten.')
  }

  let added = 0
  let replaced = 0
  const next = [...projects]

  for (const raw of parsed.projects) {
    if (!raw || typeof raw.id !== 'string' || !Array.isArray(raw.rows)) continue
    const project = migrate(raw)
    const index = next.findIndex((item) => item.id === project.id)
    if (index === -1) {
      next.unshift(project)
      added += 1
    } else {
      next[index] = project
      replaced += 1
    }
  }

  if (added === 0 && replaced === 0) {
    throw new Error('Dit bestand bevat geen Knittinerd-projecten.')
  }

  writeStorage(next)
  return { added, replaced }
}

export function createProject(input: {
  name: string
  rows: Row[]
  sections: Section[]
  glossary: GlossaryEntry[]
  lang: Lang
  sizes: SizeSet | null
  sizeIndex: number
  sourceText: string
  sourcePages: string[]
  notes?: string
}): Project {
  const now = new Date().toISOString()
  return saveProject({
    id: newId(),
    name: input.name.trim() || 'Naamloos project',
    accent: nextAccent(),
    createdAt: now,
    updatedAt: now,
    lang: input.lang,
    sections: input.sections,
    rows: input.rows,
    glossary: input.glossary,
    sizes: input.sizes,
    sizeIndex: input.sizeIndex,
    sourceText: input.sourceText,
    sourcePages: input.sourcePages,
    notes: input.notes ?? '',
  })
}
