type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
})

export const IconPlus = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconArrow = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const IconBack = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
)

export const IconCheck = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 12.5 9 17.5 20 6.5" />
  </svg>
)

export const IconUndo = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 8h11a5 5 0 0 1 0 10H8" />
    <path d="M7 4 3 8l4 4" />
  </svg>
)

export const IconSun = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
)

export const IconMoon = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z" />
  </svg>
)

export const IconTrash = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
  </svg>
)

export const IconFile = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
)

export const IconAlert = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4M12 17.5v.01" />
  </svg>
)

export const IconEye = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
)

export const IconMore = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </svg>
)

/** Beeldmerk: een streng garen met twee pennen. */
export const Logo = ({ size = 28 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
    <circle cx="10" cy="14" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M4.6 10.6c3.4 1 6.6 3.2 8.5 6.3M6.6 17.6c1.1-3.3 3.3-6 6.2-7.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M15.5 12.5 21 4M13.8 11.4 19.3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
)
