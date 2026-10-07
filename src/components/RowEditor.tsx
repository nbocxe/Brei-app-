import { IconAlert, IconPlus, IconTrash } from './icons'
import { Button, SideBadge } from './ui'
import type { Row, RowKind, Side } from '../lib/parser/types'

const SIDES: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'GK', label: 'GK' },
  { value: 'VK', label: 'VK' },
]

const KINDS: { value: RowKind; label: string }[] = [
  { value: 'row', label: 'Toer' },
  { value: 'step', label: 'Stap' },
  { value: 'note', label: 'Toelichting' },
  { value: 'repeat-until', label: 'Open herhaling' },
]

export function RowEditor({
  row,
  position,
  onChange,
  onRemove,
  onInsertAfter,
}: {
  row: Row
  position: number
  onChange: (row: Row) => void
  onRemove: () => void
  onInsertAfter: () => void
}) {
  const isNote = row.kind === 'note'

  return (
    <li className={`editrow${row.needsCheck ? ' editrow--check' : ''}${isNote ? ' editrow--note' : ''}`}>
      <div className="editrow__head">
        <span className="editrow__position">{position}</span>
        <input
          className="input editrow__label"
          value={row.label}
          aria-label={`Naam van stap ${position}`}
          onChange={(event) => onChange({ ...row, label: event.target.value })}
        />
        {row.patternLabel ? <span className="editrow__source">{row.patternLabel}</span> : null}
        <SideBadge side={row.side} size="sm" />
      </div>

      <textarea
        className="textarea editrow__instruction"
        value={row.instruction}
        rows={2}
        aria-label={`Instructie van stap ${position}`}
        onChange={(event) => onChange({ ...row, instruction: event.target.value })}
      />

      {row.sourceRef ? (
        <p className="editrow__source">Het patroon zegt hier: “{row.sourceRef}”</p>
      ) : null}

      <div className="editrow__fields">
        <label className="editrow__field">
          <span>Soort</span>
          <select
            className="input"
            value={row.kind}
            onChange={(event) => onChange({ ...row, kind: event.target.value as RowKind })}
          >
            {KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="editrow__field">
          <span>Steken</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            value={row.stitches ?? ''}
            placeholder="—"
            disabled={isNote}
            onChange={(event) => {
              const value = event.target.value
              onChange({
                ...row,
                stitches: value === '' ? null : Number(value),
                stitchesDerived: false,
              })
            }}
          />
        </label>

        <label className="editrow__field">
          <span>Kant</span>
          <select
            className="input"
            value={row.side ?? ''}
            disabled={isNote}
            onChange={(event) => onChange({ ...row, side: (event.target.value || null) as Side })}
          >
            {SIDES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="editrow__tools">
          <Button
            variant="ghost"
            className="btn--icon"
            icon={<IconPlus />}
            aria-label={`Stap toevoegen na ${position}`}
            onClick={onInsertAfter}
          />
          <Button
            variant="ghost"
            className="btn--icon"
            icon={<IconTrash />}
            aria-label={`Stap ${position} verwijderen`}
            onClick={onRemove}
          />
        </div>
      </div>

      {row.needsCheck ? (
        <p className="editrow__note">
          <IconAlert size={16} />
          <span>{row.note || 'Deze regel kon de app niet goed lezen — kijk hem even na.'}</span>
        </p>
      ) : null}
    </li>
  )
}
