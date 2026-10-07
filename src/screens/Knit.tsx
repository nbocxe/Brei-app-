import { useEffect, useRef, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { IconAlert, IconCheck, IconEye, IconMore, IconUndo } from '../components/icons'
import { Banner, Button, ProgressBar, SideBadge } from '../components/ui'
import { useProject } from '../lib/useProjects'
import { navigate } from '../lib/useRoute'
import { useWakeLock, wakeLockSupported } from '../lib/useWakeLock'
import {
  currentRowIndex,
  progressOf,
  resetProgress,
  setCurrentRow,
  setRowDone,
  setRowNote,
} from '../lib/storage/projects'
import type { Theme } from '../lib/useTheme'

export function Knit({
  id,
  theme,
  onThemeChange,
}: {
  id: string
  theme: Theme
  onThemeChange: (t: Theme) => void
}) {
  const project = useProject(id)
  const [keepAwake, setKeepAwake] = useState(true)
  const [noteOpen, setNoteOpen] = useState(false)
  const awake = useWakeLock(keepAwake)
  const currentRef = useRef<HTMLLIElement>(null)

  const index = project ? currentRowIndex(project) : 0
  const current = project?.rows[index]

  // De lijst meescrollen, zodat je nooit hoeft te zoeken waar je bent.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current?.id])

  useEffect(() => {
    setNoteOpen(false)
  }, [current?.id])

  if (!project) {
    return (
      <div className="app">
        <TopBar back="#/" theme={theme} onThemeChange={onThemeChange} />
        <main className="page">
          <Banner tone="warn" icon={<IconAlert size={18} />}>
            Dit project bestaat niet meer op dit apparaat.
          </Banner>
        </main>
      </div>
    )
  }

  const { done, total, ratio } = progressOf(project)
  const finished = total > 0 && done === total
  const sectionName = project.sections.find((section) => section.id === current?.sectionId)?.name

  const complete = () => {
    if (current && !finished) setRowDone(project.id, current.id, true)
  }

  const stepBack = () => {
    const previous = [...project.rows].reverse().find((row) => row.done)
    if (previous) setRowDone(project.id, previous.id, false)
  }

  return (
    <div className="app app--knit">
      <TopBar
        back="#/"
        theme={theme}
        onThemeChange={onThemeChange}
        title={project.name}
        actions={
          <Button
            variant="ghost"
            className="btn--icon"
            icon={<IconMore />}
            aria-label="Projectinstellingen"
            onClick={() => navigate(`#/project/${encodeURIComponent(project.id)}/instellingen`)}
          />
        }
      />

      <div className="now">
        <div className="now__inner">
          {finished ? (
            <>
              <p className="now__section">Klaar</p>
              <p className="now__instruction">
                Alle {total} toeren afgevinkt. Mooi werk.
              </p>
              <div className="row-actions">
                <Button variant="secondary" onClick={() => resetProgress(project.id)}>
                  Opnieuw beginnen
                </Button>
                <Button variant="ghost" onClick={() => navigate('#/')}>
                  Terug naar projecten
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="now__meta">
                <span className="now__label">{current?.label}</span>
                {sectionName ? <span className="now__section">{sectionName}</span> : null}
                <SideBadge side={current?.side ?? null} />
                {current?.stitches !== null && current?.stitches !== undefined ? (
                  <span className={`now__stitches${current.stitchesDerived ? ' now__stitches--derived' : ''}`}>
                    {current.stitches} steken
                  </span>
                ) : null}
              </div>

              <p className="now__instruction">{current?.instruction || '—'}</p>

              {current?.needsCheck && current.note ? (
                <p className="now__warn">
                  <IconAlert size={16} />
                  <span>{current.note}</span>
                </p>
              ) : null}

              {noteOpen ? (
                <textarea
                  className="textarea now__note"
                  rows={2}
                  autoFocus
                  placeholder="Aantekening bij deze toer"
                  value={current?.note ?? ''}
                  onChange={(event) => current && setRowNote(project.id, current.id, event.target.value)}
                />
              ) : current?.note && !current.needsCheck ? (
                <p className="now__notetext">{current.note}</p>
              ) : null}

              <div className="now__tools">
                <button className="linkish" type="button" onClick={() => setNoteOpen((open) => !open)}>
                  {noteOpen ? 'Aantekening sluiten' : 'Aantekening'}
                </button>
                {wakeLockSupported() ? (
                  <button
                    className="linkish"
                    type="button"
                    onClick={() => setKeepAwake((value) => !value)}
                  >
                    <IconEye size={15} />
                    {awake ? 'Scherm blijft aan' : 'Scherm mag uitgaan'}
                  </button>
                ) : null}
              </div>
            </>
          )}

          <div className="now__progress">
            <ProgressBar ratio={ratio} label={`Voortgang van ${project.name}`} />
            <span className="now__count">
              {done} van {total} toeren
            </span>
          </div>
        </div>
      </div>

      <main className="page page--knit">
        <ol className="rows">
          {project.rows.map((row, position) => {
            const isCurrent = position === index && !finished
            return (
              <li
                key={row.id}
                ref={isCurrent ? currentRef : null}
                className={`krow${row.done ? ' krow--done' : ''}${isCurrent ? ' krow--current' : ''}`}
              >
                <label className="krow__check">
                  <input
                    type="checkbox"
                    checked={row.done}
                    onChange={(event) => setRowDone(project.id, row.id, event.target.checked)}
                  />
                  <span className="krow__box" aria-hidden>
                    <IconCheck size={14} />
                  </span>
                  <span className="sr-only">{row.label} afvinken</span>
                </label>

                <button
                  className="krow__body"
                  type="button"
                  onClick={() => setCurrentRow(project.id, row.id)}
                  title="Ik ben hier"
                >
                  <span className="krow__label">
                    {row.label}
                    {row.needsCheck ? <IconAlert size={13} /> : null}
                  </span>
                  <span className="krow__instruction">{row.instruction}</span>
                </button>

                <span className="krow__right">
                  {row.stitches !== null ? (
                    <span className={`krow__stitches${row.stitchesDerived ? ' krow__stitches--derived' : ''}`}>
                      {row.stitches}
                    </span>
                  ) : null}
                  <SideBadge side={row.side} size="sm" />
                </span>
              </li>
            )
          })}
        </ol>
      </main>

      {!finished ? (
        <div className="bottombar">
          <div className="bottombar__inner">
            <Button
              variant="secondary"
              className="btn--icon btn--lg"
              icon={<IconUndo />}
              aria-label="Vorige toer terugzetten"
              disabled={done === 0}
              onClick={stepBack}
            />
            <Button variant="primary" size="lg" className="grow" icon={<IconCheck />} onClick={complete}>
              Klaar — volgende toer
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
