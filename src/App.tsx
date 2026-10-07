import { useRoute } from './lib/useRoute'
import { useTheme } from './lib/useTheme'
import { Home } from './screens/Home'
import { Import } from './screens/Import'
import { Knit } from './screens/Knit'
import { Settings } from './screens/Settings'

export function App() {
  const route = useRoute()
  const [theme, setTheme] = useTheme()
  const themeProps = { theme, onThemeChange: setTheme }

  if (route.name === 'import') return <Import {...themeProps} />
  if (route.name === 'knit') return <Knit id={route.id} {...themeProps} />
  if (route.name === 'settings') return <Settings id={route.id} {...themeProps} />
  return <Home {...themeProps} />
}
