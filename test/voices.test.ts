import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VOICE_PRESET_ID,
  isKnownVoicePreset,
  VOICE_PRESETS,
  voicePreset,
} from '../src/ai/voices'

// The preset registry backs the Settings selector and the read-aloud request.
// The default must be an offered preset, ids unique, and the v3 preset must
// respect the model's own constraint on stability.
describe('voice preset registry', () => {
  it('offers the house quality setting and a fast one', () => {
    expect(VOICE_PRESETS.map((p) => p.id).sort()).toEqual(['fast', 'quality'])
  })

  it('defaults to the content-machine house setting: eleven_v3 at 192 kbps, style 0', () => {
    expect(DEFAULT_VOICE_PRESET_ID).toBe('quality')
    const quality = voicePreset('quality')
    expect(quality.modelId).toBe('eleven_v3')
    expect(quality.outputFormat).toBe('mp3_44100_192')
    expect(quality.voiceSettings).toEqual({
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0,
      use_speaker_boost: true,
    })
  })

  it('keeps v3 stability on one of the three values the model accepts', () => {
    for (const p of VOICE_PRESETS.filter((p) => p.modelId === 'eleven_v3')) {
      expect([0, 0.5, 1], p.id).toContain(p.voiceSettings.stability)
    }
  })

  it('keeps the previous viewer setting as the fast preset', () => {
    const fast = voicePreset('fast')
    expect(fast.modelId).toBe('eleven_turbo_v2_5')
    expect(fast.outputFormat).toBe('mp3_44100_128')
    expect(fast.voiceSettings.stability).toBe(0.7)
    expect(fast.voiceSettings.style).toBe(0.3)
  })

  it('resolves an unknown id to the default', () => {
    expect(isKnownVoicePreset('studio')).toBe(false)
    expect(voicePreset('studio').id).toBe(DEFAULT_VOICE_PRESET_ID)
    expect(isKnownVoicePreset(DEFAULT_VOICE_PRESET_ID)).toBe(true)
  })

  it('has unique ids', () => {
    expect(new Set(VOICE_PRESETS.map((p) => p.id)).size).toBe(VOICE_PRESETS.length)
  })
})
