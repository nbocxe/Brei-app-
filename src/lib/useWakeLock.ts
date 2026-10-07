import { useEffect, useState } from 'react'

type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (type: string, listener: () => void) => void }
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } }

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

/**
 * Houdt het scherm aan tijdens het breien. De browser laat de vergrendeling los
 * zodra je naar een ander tabblad gaat, dus die vragen we daarna opnieuw aan.
 */
export function useWakeLock(enabled: boolean): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled || !wakeLockSupported()) {
      setActive(false)
      return
    }

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        sentinel = (await (navigator as WakeLockNavigator).wakeLock!.request('screen')) ?? null
        if (cancelled) {
          await sentinel?.release()
          return
        }
        setActive(true)
        sentinel?.addEventListener('release', () => setActive(false))
      } catch {
        setActive(false)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => undefined)
      setActive(false)
    }
  }, [enabled])

  return active
}
