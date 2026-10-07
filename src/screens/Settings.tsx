import { useState } from 'react'
import { TopBar } from '../components/TopBar'
import { IconAlert, IconTrash } from '../components/icons'
import { Banner, Button, Field } from '../components/ui'
import { useProject } from '../lib/useProjects'
import { navigate } from '../lib/useRoute'
import {
  ACCENTS,
  exportProjects,
  removeProject,
  resetProgress,
  updateProject,
} from '../lib/storage/projects'
import type { Theme } from '../lib/useTheme'

export function Settings({
  id,
  theme,
  onThemeChange,
}: {
  id: string
  theme: Theme
  onThemeChange: (t: Theme) => void
}) {
  const project = useProject(id)
  const [confirming, setConfirming] = useState(false)

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

  const back = `#/project/${encodeURIComponent(project.id)}`

  const handleExport = () => {
    const blob = new Blob([exportProjects([project.id])], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name.replace(/[^\w\s-]/g, '').trim() || 'project'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <TopBar back={back} theme={theme} onThemeChange={onThemeChange} title="Instellingen" />

      <main className="page stack">
        <h1 className="screen-title">{project.name}</h1>

        <Field label="Naam">
          <input
            className="input"
            value={project.name}
            onChange={(event) =>
              updateProject(project.id, (current) => ({ ...current, name: event.target.value }))
            }
          />
        </Field>

        <Field label="Kleur van de kaart">
          <div className="swatches">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                className={`swatch swatch--${accent}${project.accent === accent ? ' swatch--on' : ''}`}
                aria-label={`Kleur ${accent}`}
                aria-pressed={project.accent === accent}
                onClick={() => updateProject(project.id, (current) => ({ ...current, accent }))}
              />
            ))}
          </div>
        </Field>

        <Field label="Aantekeningen" hint="Naalden, garen, spanning — en wat je verder wilt onthouden.">
          <textarea
            className="textarea"
            value={project.notes}
            rows={6}
            onChange={(event) =>
              updateProject(project.id, (current) => ({ ...current, notes: event.target.value }))
            }
          />
        </Field>

        <div className="section">
          <div className="section__head">
            <h2>Voortgang</h2>
          </div>
          <p className="muted">
            {project.rows.filter((row) => row.done).length} van {project.rows.length} toeren
            afgevinkt.
          </p>
          <div className="row-actions">
            <Button onClick={() => resetProgress(project.id)}>Alle vinkjes wissen</Button>
            <Button onClick={handleExport}>Project opslaan als bestand</Button>
          </div>
        </div>

        {project.sourceText ? (
          <details className="leftovers">
            <summary>De oorspronkelijke patroontekst</summary>
            <pre className="sourcetext">{project.sourceText}</pre>
          </details>
        ) : null}

        <div className="section">
          <div className="section__head">
            <h2>Verwijderen</h2>
          </div>
          {confirming ? (
            <Banner tone="warn" icon={<IconAlert size={18} />}>
              <p>
                Weet je het zeker? <strong>{project.name}</strong> en je voortgang verdwijnen dan
                van dit apparaat.
              </p>
              <div className="row-actions">
                <Button
                  variant="danger"
                  icon={<IconTrash />}
                  onClick={() => {
                    removeProject(project.id)
                    navigate('#/')
                  }}
                >
                  Ja, verwijder
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Nee, laat staan
                </Button>
              </div>
            </Banner>
          ) : (
            <Button variant="danger" icon={<IconTrash />} onClick={() => setConfirming(true)}>
              Project verwijderen
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
