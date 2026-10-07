import { useSyncExternalStore } from 'react'
import { getProject, getProjects, subscribe, type Project } from './storage/projects'

export function useProjects(): Project[] {
  return useSyncExternalStore(subscribe, getProjects, getProjects)
}

export function useProject(id: string): Project | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getProject(id),
    () => getProject(id),
  )
}
