import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'import' }
  | { name: 'knit'; id: string }
  | { name: 'settings'; id: string }

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (path[0] === 'nieuw') return { name: 'import' }
  if (path[0] === 'project' && path[1]) {
    return path[2] === 'instellingen'
      ? { name: 'settings', id: decodeURIComponent(path[1]) }
      : { name: 'knit', id: decodeURIComponent(path[1]) }
  }
  return { name: 'home' }
}

export function navigate(to: string) {
  if (window.location.hash === to) return
  window.location.hash = to
}

/** De weg terug, zodat de telefoonknop 'terug' doet wat je verwacht. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const update = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route.name, 'id' in route ? route.id : ''])

  return route
}
