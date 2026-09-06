/**
 * The selected Claude model, persisted in `localStorage` like the BYO keys, so
 * the choice survives reloads. Falls back to `DEFAULT_MODEL_ID` when nothing
 * valid is stored — see `usePersistentChoice`.
 */
import { DEFAULT_MODEL_ID, isKnownModel } from '../ai/models'
import { usePersistentChoice } from './usePersistentChoice'

const STORAGE_KEY = 'holon-viewer:model'

export interface ModelSelection {
  /** The selected Anthropic model id (always a known model). */
  model: string
  /** Set the model; an unknown id resets to the default. */
  setModel: (id: string) => void
}

export function usePersistentModel(): ModelSelection {
  const { id, set } = usePersistentChoice({
    storageKey: STORAGE_KEY,
    defaultId: DEFAULT_MODEL_ID,
    isKnown: isKnownModel,
  })
  return { model: id, setModel: set }
}
