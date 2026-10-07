import { useRef, useState } from 'react'
import { TopBar } from '../components/TopBar'
import { IconArrow, IconPlus } from '../components/icons'
import { Banner, Button, EmptyState, ProgressBar } from '../components/ui'
import { navigate } from '../lib/useRoute'
import { useProjects } from '../lib/useProjects'
import {
  currentRowIndex,
  exportProjects,
  importProjects,
  progressOf,
  type Project,
} from '../lib/storage/projects'
import type { Theme } from '../lib/useTheme'

function lastWorkedOn(project: Project): string {
  const updated = new Date(project.updatedAt)
  const days = Math.floor((Date.now() - updated.getTime()) / 86_400_000)
  if (days <= 0) return 'vandaag'
  if (days === 1) return 'gisteren'
  if (days < 7) return `${days} dagen geleden`
  return updated.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

function ProjectCard({ project }: { project: Project }) {
  const { done, total, ratio } = progressOf(project)
  const current = project.rows[currentRowIndex(project)]
  const finished = total > 0 && done === total

  return (
    <button
      className={`card card--${project.accent}`}
      onClick={() => navigate(`#/project/${encodeURIComponent(project.id)}`)}
    >
      <span className="card__top">
        <span className="card__meta">{lastWorkedOn(project)}</span>
        <span className="card__arrow">
          <IconArrow size={18} />
        </span>
      </span>

      <span className="card__name">{project.name}</span>

      <span className="card__status">
        {total === 0
          ? 'Nog geen toeren'
          : finished
            ? 'Helemaal af'
            : `${current?.label ?? 'Toer 1'} van ${total}`}
      </span>

      <ProgressBar ratio={ratio} label={`Voortgang van ${project.name}`} />
      <span className="card__count">
        {done} van {total} afgevinkt
      </span>
    </button>
  )
}

export function Home({ theme, onThemeChange }: { theme: Theme; onThemeChange: (t: Theme) => void }) {
  const projects = useProjects()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleExport = () => {
    const blob = new Blob([exportProjects()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `knittinerd-${today}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File) => {
    try {
      const result = importProjects(await file.text())
      setMessage(
        `${result.added} ${result.added === 1 ? 'project' : 'projecten'} toegevoegd` +
          (result.replaced > 0 ? `, ${result.replaced} bijgewerkt.` : '.'),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dit bestand kon niet gelezen worden.')
    }
  }

  return (
    <div className="app">
      <TopBar theme={theme} onThemeChange={onThemeChange} />

      <main className="page">
        <section className="hero">
          <h1>
            Brei rij
            <br />
            voor rij.
          </h1>
          <p className="hero__body">
            Kies je patroon-PDF. Knittinerd leest de instructies uit en maakt er een lijst van
            waarin je elke afgewerkte toer afvinkt — geen toerenteller of vinger op papier meer
            nodig.
          </p>
          <Button
            variant="primary"
            size="lg"
            icon={<IconPlus />}
            onClick={() => navigate('#/nieuw')}
          >
            Nieuw project
          </Button>
        </section>

        {message ? <Banner>{message}</Banner> : null}

        <section className="section">
          <div className="section__head">
            <h2>Je projecten</h2>
            {projects.length > 0 ? <span className="section__count">{projects.length}</span> : null}
          </div>

          {projects.length === 0 ? (
            <EmptyState
              title="Nog geen projecten"
              action={
                <Button variant="secondary" onClick={() => navigate('#/nieuw')}>
                  Begin met een patroon
                </Button>
              }
            >
              Zodra je een patroon inleest verschijnt het hier, met de toer waar je gebleven was.
            </EmptyState>
          ) : (
            <div className="cards">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section__head">
            <h2>Back-up</h2>
          </div>
          <p className="muted">
            Je projecten staan alleen op dit apparaat. Sla ze als bestand op om ze te bewaren of
            naar je laptop te sturen.
          </p>
          <div className="row-actions">
            <Button onClick={handleExport} disabled={projects.length === 0}>
              Opslaan als bestand
            </Button>
            <Button onClick={() => fileInput.current?.click()}>Bestand inlezen</Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImport(file)
                event.target.value = ''
              }}
            />
          </div>
        </section>
      </main>
    </div>
  )
}
