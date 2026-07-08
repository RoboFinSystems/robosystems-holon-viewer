/**
 * The selected Claude model, persisted in `localStorage` like the BYO keys, so
 * the choice survives reloads. Falls back to `DEFAULT_MODEL_ID` when nothing
 * valid is stored (an unknown id — e.g. a model we dropped — degrades to the
 * default rather than erroring on the wire).
 *
 * Cross-tab (`storage`) and same-tab (`CHANGE_EVENT`) sync keep the Settings
 * selector and the chat loop's instance in agreement — mirrors
 * `usePersistentApiKey`.
 */
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_MODEL_ID, isKnownModel } from '../ai/models'

const STORAGE_KEY = 'holon-viewer:model'
const CHANGE_EVENT = 'holon-viewer:model-change'

function read(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL_ID
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored && isKnownModel(stored) ? stored : DEFAULT_MODEL_ID
  } catch {
    // localStorage can throw in private mode or when storage is disabled.
    return DEFAULT_MODEL_ID
  }
}

export interface ModelSelection {
  /** The selected Anthropic model id (always a known model). */
  model: string
  /** Set the model; an unknown id resets to the default. */
  setModel: (id: string) => void
}

export function usePersistentModel(): ModelSelection {
  const [model, setModelState] = useState<string>(read)

  const setModel = useCallback((id: string) => {
    const next = isKnownModel(id) ? id : DEFAULT_MODEL_ID
    setModelState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
    } catch {
      // Ignore write failures (private mode); the choice still holds this session.
    }
  }, [])

  useEffect(() => {
    const reread = () => setModelState(read())
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) reread()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, reread)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, reread)
    }
  }, [])

  return { model, setModel }
}
