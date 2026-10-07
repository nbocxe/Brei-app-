import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Side } from '../lib/parser/types'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      {...rest}
    >
      {icon}
      {children ? <span>{children}</span> : null}
    </button>
  )
}

/**
 * Goede of verkeerde kant. Vorm en tekst verschillen allebei, zodat de badge
 * ook zonder kleur te onderscheiden is.
 */
export function SideBadge({ side, size = 'md' }: { side: Side; size?: 'sm' | 'md' }) {
  if (!side) return null
  const label = side === 'GK' ? 'goede kant' : 'verkeerde kant'
  return (
    <span className={`side side--${side.toLowerCase()} side--${size}`} title={label}>
      <span aria-hidden>{side}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function ProgressBar({ ratio, label }: { ratio: number; label?: string }) {
  const percentage = Math.round(ratio * 100)
  return (
    <div className="progress">
      <div
        className="progress__track"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Voortgang'}
      >
        <div className="progress__fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export function Banner({
  tone = 'info',
  icon,
  children,
}: {
  tone?: 'info' | 'warn'
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`banner banner--${tone}`}>
      {icon ? <span className="banner__icon">{icon}</span> : null}
      <div>{children}</div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p className="empty__body">{children}</p> : null}
      {action}
    </div>
  )
}
