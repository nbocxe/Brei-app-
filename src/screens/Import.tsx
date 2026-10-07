import { useRef, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { RowEditor } from '../components/RowEditor'
import { IconAlert, IconCheck, IconFile } from '../components/icons'
import { Banner, Button, Field } from '../components/ui'
import { describePdfError, extractPdfText } from '../lib/pdf/extractText'
import { parsePattern } from '../lib/parser/buildRows'
import { normalize } from '../lib/parser/normalize'
import { detectSizes, type SizeSet } from '../lib/parser/sizes'
import { createProject, newId } from '../lib/storage/projects'
import { navigate } from '../lib/useRoute'
import type { Theme } from '../lib/useTheme'
import type { ParseResult, Row } from '../lib/parser/types'

type Step = 'choose' | 'paste' | 'size' | 'review'

function emptyRow(): Row {
  return {
    id: newId(),
    kind: 'row',
    label: 'Nieuwe stap',
    patternLabel: null,
    rowNumber: null,
    instruction: '',
    sourceRef: null,
    side: null,
    stitches: null,
    stitchesDerived: false,
    sectionId: null,
    needsCheck: false,
    note: '',
    counter: null,
    done: false,
  }
}

function nameFromFile(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim()
}

export function Import({ theme, onThemeChange }: { theme: Theme; onThemeChange: (t: Theme) => void }) {
  const [step, setStep] = useState<Step>('choose')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [name, setName] = useState('')
  const [pages, setPages] = useState<string[]>([])
  const [sizes, setSizes] = useState<SizeSet | null>(null)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const runParse = (source: string[], found: SizeSet | null, index: number) => {
    const parsed = parsePattern(source, { sizes: found, sizeIndex: index })
    setResult(parsed)
    setRows(parsed.rows)
    setStep('review')
  }

  /** Eerst de maat, want die bepaalt elk getal in het patroon. */
  const start = (source: string[]) => {
    setPages(source)
    const found = detectSizes(normalize(source))
    setSizes(found)
    if (found) {
      setSizeIndex(0)
      setStep('size')
      return
    }
    runParse(source, null, 0)
  }

  const handleFile = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const extraction = await extractPdfText(file)
      if (!name) setName(nameFromFile(file.name))

      if (extraction.isScanned) {
        setError(
          `Deze PDF (${extraction.pageCount} ${extraction.pageCount === 1 ? 'pagina' : "pagina's"}) ` +
            'bestaat uit afbeeldingen, er zit geen leesbare tekst in. Plak de patroontekst hieronder, ' +
            'dan gaat het verder zoals gewoonlijk.',
        )
        setStep('paste')
        return
      }

      start(extraction.pages)
    } catch (caught) {
      setError(describePdfError(caught))
      setStep('paste')
    } finally {
      setBusy(false)
    }
  }

  const updateRow = (index: number, row: Row) =>
    setRows((current) => current.map((item, i) => (i === index ? row : item)))

  const removeRow = (index: number) => setRows((current) => current.filter((_, i) => i !== index))

  const insertAfter = (index: number) =>
    setRows((current) => [...current.slice(0, index + 1), emptyRow(), ...current.slice(index + 1)])

  const renumber = () =>
    setRows((current) => {
      let number = 0
      const word = result?.lang === 'en' ? 'Row' : 'Toer'
      return current.map((row) => {
        if (row.kind !== 'row') return row
        number += 1
        return { ...row, rowNumber: number, label: `${word} ${number}` }
      })
    })

  const save = () => {
    if (!result) return
    const project = createProject({
      name: name.trim() || 'Naamloos project',
      rows,
      sections: result.sections,
      glossary: result.glossary,
      lang: result.lang,
      sizes,
      sizeIndex,
      sourceText: result.text,
      sourcePages: pages,
      notes: result.leftovers.join('\n'),
    })
    navigate(`#/project/${encodeURIComponent(project.id)}`)
  }

  const needsCheck = rows.filter((row) => row.needsCheck).length
  const knitRows = rows.filter((row) => row.kind !== 'note').length

  return (
    <div className="app">
      <TopBar back="#/" theme={theme} onThemeChange={onThemeChange} title="Nieuw project" />

      <main className="page">
        {step === 'choose' || step === 'paste' ? (
          <>
            <h1 className="screen-title">Lees je patroon in</h1>
            <p className="muted screen-intro">
              De PDF wordt op je eigen apparaat gelezen en nergens naartoe gestuurd.
            </p>

            {step === 'choose' ? (
              <div
                className={`dropzone${dragging ? ' dropzone--over' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  const file = event.dataTransfer.files?.[0]
                  if (file) void handleFile(file)
                }}
              >
                <IconFile size={32} />
                <p className="dropzone__title">
                  {busy ? 'Bezig met lezen…' : 'Sleep je patroon-PDF hierheen'}
                </p>
                <Button variant="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
                  Kies een PDF
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleFile(file)
                    event.target.value = ''
                  }}
                />
                <button className="linkish" type="button" onClick={() => setStep('paste')}>
                  Of plak de tekst zelf
                </button>
              </div>
            ) : null}

            {error ? (
              <Banner tone="warn" icon={<IconAlert size={18} />}>
                {error}
              </Banner>
            ) : null}

            {step === 'paste' ? (
              <div className="stack">
                <Field
                  label="Patroontekst"
                  hint="Nederlands of Engels. Toeren, herhalingen en stekenaantallen worden herkend."
                >
                  <textarea
                    className="textarea"
                    rows={12}
                    value={pasted}
                    placeholder={'Zet 23 steken op.\n\nToer 1 (GK): recht tot de laatste 2 steken, mva, 1 recht (24 st)\nToer 2 (VK): 1 recht, mva, brei tot het einde (25 st)\nHerhaal toer 1 en 2 nog 4 keer.'}
                    onChange={(event) => setPasted(event.target.value)}
                  />
                </Field>
                <div className="row-actions">
                  <Button
                    variant="primary"
                    disabled={pasted.trim() === ''}
                    onClick={() => {
                      if (pasted.trim() === '') return
                      setError(null)
                      start([pasted])
                    }}
                  >
                    Lees de tekst uit
                  </Button>
                  <Button variant="ghost" onClick={() => setStep('choose')}>
                    Toch een PDF kiezen
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 'size' && sizes ? (
          <>
            <h1 className="screen-title">Welke maat brei je?</h1>
            <p className="muted screen-intro">
              Dit patroon geeft elk aantal per maat. Kies je maat, dan staat er overal alleen jouw
              getal — geen haakjes meer om doorheen te lezen.
            </p>

            <div className="sizes">
              {sizes.names.map((size, index) => (
                <button
                  key={size}
                  type="button"
                  className={`sizebtn${index === sizeIndex ? ' sizebtn--on' : ''}`}
                  aria-pressed={index === sizeIndex}
                  onClick={() => setSizeIndex(index)}
                >
                  {size}
                </button>
              ))}
            </div>

            <p className="muted screen-intro">Gevonden in het patroon: “{sizes.line}”.</p>

            <div className="row-actions">
              <Button variant="primary" size="lg" onClick={() => runParse(pages, sizes, sizeIndex)}>
                Verder
              </Button>
              <Button variant="ghost" onClick={() => runParse(pages, null, 0)}>
                Alle maten laten staan
              </Button>
            </div>
          </>
        ) : null}

        {step === 'review' && result ? (
          <>
            <h1 className="screen-title">Kijk de toeren na</h1>
            <p className="muted screen-intro">
              Klopt alles? Dan sla je het project op en kun je beginnen. Je kunt elke stap hier nog
              aanpassen.
            </p>

            <div className="stats">
              <div className="stat">
                <span className="stat__value">{knitRows}</span>
                <span className="stat__label">toeren gevonden</span>
              </div>
              <div className="stat">
                <span className="stat__value">{result.stats.fromRepeats}</span>
                <span className="stat__label">uitgeschreven uit herhalingen</span>
              </div>
              <div className="stat">
                <span className="stat__value">{needsCheck}</span>
                <span className="stat__label">na te kijken</span>
              </div>
            </div>

            {sizes ? (
              <Banner>
                Uitgeschreven voor maat <strong>{sizes.names[sizeIndex]}</strong>. De andere maten
                zijn weggelaten; je kunt dit later in de instellingen omzetten.
              </Banner>
            ) : null}

            {result.warnings.map((warning) => (
              <Banner key={warning} tone="warn" icon={<IconAlert size={18} />}>
                {warning}
              </Banner>
            ))}

            {needsCheck > 0 ? (
              <Banner tone="warn" icon={<IconAlert size={18} />}>
                {needsCheck === 1
                  ? 'Eén stap kon de app niet goed lezen. Die is hieronder gemarkeerd.'
                  : `${needsCheck} stappen kon de app niet goed lezen. Die zijn hieronder gemarkeerd.`}
              </Banner>
            ) : null}

            <div className="stack">
              <Field label="Naam van het project">
                <input
                  className="input"
                  value={name}
                  placeholder="Bijvoorbeeld: trui voor Sam"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
            </div>

            <div className="section__head">
              <h2>Toeren</h2>
              <Button variant="ghost" onClick={renumber}>
                Opnieuw nummeren
              </Button>
            </div>

            <ol className="editrows">
              {rows.map((row, index) => (
                <RowEditor
                  key={row.id}
                  row={row}
                  position={index + 1}
                  onChange={(next) => updateRow(index, next)}
                  onRemove={() => removeRow(index)}
                  onInsertAfter={() => insertAfter(index)}
                />
              ))}
            </ol>

            <Button variant="secondary" onClick={() => setRows((current) => [...current, emptyRow()])}>
              Stap toevoegen
            </Button>

            {result.glossary.length > 0 ? (
              <details className="leftovers">
                <summary>Afkortingen uit het patroon ({result.glossary.length})</summary>
                <dl className="glossary">
                  {result.glossary.map((entry) => (
                    <div key={entry.term}>
                      <dt>{entry.term}</dt>
                      <dd>{entry.meaning}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}

            {result.leftovers.length > 0 ? (
              <details className="leftovers">
                <summary>
                  Niet als toer herkend ({result.leftovers.length}) — bijvoorbeeld garen en naalden
                </summary>
                <p className="muted">
                  Deze regels komen als aantekening bij je project te staan. Hoort er toch een toer
                  bij, voeg die dan hierboven zelf toe.
                </p>
                <ul>
                  {result.leftovers.map((line, index) => (
                    <li key={`${line}-${index}`}>{line}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : null}
      </main>

      {step === 'review' ? (
        <div className="bottombar">
          <div className="bottombar__inner">
            <Button variant="ghost" onClick={() => setStep('choose')}>
              Opnieuw
            </Button>
            <Button
              variant="primary"
              size="lg"
              icon={<IconCheck />}
              disabled={rows.length === 0}
              onClick={save}
            >
              Project opslaan
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
