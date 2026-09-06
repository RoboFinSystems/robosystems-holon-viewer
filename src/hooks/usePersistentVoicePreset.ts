/**
 * The selected ElevenLabs preset (model, bitrate, voice settings), persisted
 * like the model choice. Falls back to the house "quality" preset when nothing
 * valid is stored — see `usePersistentChoice`.
 */
import {
  DEFAULT_VOICE_PRESET_ID,
  isKnownVoicePreset,
  type VoicePreset,
  voicePreset,
} from '../ai/voices'
import { usePersistentChoice } from './usePersistentChoice'

const STORAGE_KEY = 'holon-viewer:voice-preset'

export interface VoicePresetSelection {
  /** The selected preset (always one we offer). */
  preset: VoicePreset
  /** Set the preset by id; an unknown id resets to the default. */
  setPreset: (id: string) => void
}

export function usePersistentVoicePreset(): VoicePresetSelection {
  const { id, set } = usePersistentChoice({
    storageKey: STORAGE_KEY,
    defaultId: DEFAULT_VOICE_PRESET_ID,
    isKnown: isKnownVoicePreset,
  })
  return { preset: voicePreset(id), setPreset: set }
}
