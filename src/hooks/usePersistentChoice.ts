/**
 * A persisted pick from a fixed list — the Claude model, the voice preset —
 * stored in `localStorage` like the BYO keys so it survives reloads, and
 * falling back to the default when nothing valid is stored (an id we have
 * since dropped degrades to the default rather than erroring on the wire).
 *
 * Cross-tab (`storage`) and same-tab (custom event) sync keep the Settings
 * selector and the consumer's instance in agreement — mirrors
 * `usePersistentApiKey`.
 */
import { useCallback, useEffect, useState } from 'react'

const CHANGE_EVENT = 'holon-viewer:choice-change'

export interface PersistentChoiceConfig {
  storageKey: string
  defaultId: string
  /** Whether an id is one we still offer. */
  isKnown: (id: string) => boolean
}

export interface PersistentChoice {
  /** The selected id (always a known one). */
  id: string
  /** Set the choice; an unknown id resets to the default. */
  set: (id: string) => void
}

function read({ storageKey, defaultId, isKnown }: PersistentChoiceConfig): string {
  if (typeof window === 'undefined') return defaultId
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored && isKnown(stored) ? stored : defaultId
  } catch {
    // localStorage can throw in private mode or when storage is disabled.
    return defaultId
  }
}

export function usePersistentChoice(config: PersistentChoiceConfig): PersistentChoice {
  const { storageKey, defaultId, isKnown } = config
  const [id, setIdState] = useState<string>(() => read(config))

  const set = useCallback(
    (next: string) => {
      const value = isKnown(next) ? next : defaultId
      setIdState(value)
      try {
        window.localStorage.setItem(storageKey, value)
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: storageKey }))
      } catch {
        // Ignore write failures (private mode); the choice still holds this session.
      }
    },
    [storageKey, defaultId, isKnown]
  )

  useEffect(() => {
    const reread = () => setIdState(read({ storageKey, defaultId, isKnown }))
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) reread()
    }
    const onLocal = (e: Event) => {
      if ((e as CustomEvent<string>).detail === storageKey) reread()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onLocal)
    }
  }, [storageKey, defaultId, isKnown])

  return { id, set }
}
