/**
 * The ElevenLabs presets the read-aloud can run with — the voice *settings*,
 * not the voice: which model, at what bitrate, with what stability and style.
 *
 * The default is the content-machine house setting
 * (`tools/generate_voiceover_audio.py`), chosen there by ear from an A/B of
 * the same sentence and for measured reasons: eleven_turbo_v2_5 stochastically
 * inserted multi-second dead air mid-segment (2–3.5 s across four takes,
 * 2026-07-27) and eleven_v3 does not (12 takes, none over 1.5 s); 192 kbps
 * removes the compression mush that reads as slurring; style 0 keeps the read
 * even. Turbo stays offered because it starts sooner — v3 is the quality
 * model, not the latency model, and this surface plays live.
 *
 * A preset id flows Settings (`usePersistentVoicePreset`) → `useTts` →
 * `synthesizeSpeech`. Same shape and lifecycle as `models.ts`.
 */

export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export interface VoicePreset {
  id: string
  /** Short label for the selector. */
  label: string
  /** One-line quality / latency hint shown under the selector. */
  blurb: string
  /** ElevenLabs model id sent on the wire. */
  modelId: string
  /** The `output_format` query parameter (codec_sampleRate_bitrate). */
  outputFormat: string
  voiceSettings: VoiceSettings
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'quality',
    label: 'Quality — Eleven v3',
    blurb:
      'The house narration setting: the highest-fidelity model at 192 kbps, an even read. Takes longer to start speaking.',
    modelId: 'eleven_v3',
    outputFormat: 'mp3_44100_192',
    // eleven_v3 accepts only 0, 0.5 or 1 for stability (Creative / Natural / Robust).
    voiceSettings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
  },
  {
    id: 'fast',
    label: 'Fast — Turbo v2.5',
    blurb:
      'The latency model: starts speaking sooner, at 128 kbps. Can drop a few seconds of dead air mid-sentence.',
    modelId: 'eleven_turbo_v2_5',
    outputFormat: 'mp3_44100_128',
    voiceSettings: { stability: 0.7, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
  },
]

/** Fidelity over first-word latency, matching what the narrations ship with. */
export const DEFAULT_VOICE_PRESET_ID = 'quality'

const BY_ID = new Map(VOICE_PRESETS.map((p) => [p.id, p]))

/** True when `id` is one of the offered presets. */
export function isKnownVoicePreset(id: string): boolean {
  return BY_ID.has(id)
}

/** The preset for `id`, or the default when it is not one we offer. */
export function voicePreset(id: string): VoicePreset {
  return BY_ID.get(id) ?? (BY_ID.get(DEFAULT_VOICE_PRESET_ID) as VoicePreset)
}
