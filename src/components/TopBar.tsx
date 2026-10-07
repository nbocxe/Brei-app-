import type { ReactNode } from 'react'
import { IconBack, IconMoon, IconSun, Logo } from './icons'
import { Button } from './ui'
import { navigate } from '../lib/useRoute'
import { useSystemDark, type Theme } from '../lib/useTheme'

export function TopBar({
  back,
  title,
  theme,
  onThemeChange,
  actions,
}: {
  back?: string
  title?: string
  theme: Theme
  onThemeChange: (theme: Theme) => void
  actions?: ReactNode
}) {
  // Eén knop die het thema omzet; 'systeem' volgt de voorkeur van het apparaat.
  const systemDark = useSystemDark()
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  return (
    <header className="topbar">
      <div className="topbar__inner">
        {back ? (
          <Button
            variant="ghost"
            className="btn--icon"
            icon={<IconBack />}
            aria-label="Terug"
            onClick={() => navigate(back)}
          />
        ) : (
          <span className="topbar__brand">
            <Logo />
            <span>Knittinerd</span>
          </span>
        )}

        {title ? <span className="topbar__title">{title}</span> : <span />}

        <div className="topbar__actions">
          {actions}
          <Button
            variant="ghost"
            className="btn--icon"
            icon={isDark ? <IconSun /> : <IconMoon />}
            aria-label={isDark ? 'Lichte weergave' : 'Donkere weergave'}
            onClick={() => onThemeChange(isDark ? 'light' : 'dark')}
          />
        </div>
      </div>
    </header>
  )
}
