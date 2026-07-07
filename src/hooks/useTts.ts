/**
 * Speak text with ElevenLabs, managing a single audio stream for the session.
 *
 * Owns one `HTMLAudioElement`: a new `speak()` cancels whatever was playing, and
 * object URLs are revoked as they're replaced (and on unmount) so blobs don't
 * leak. The ElevenLabs key + optional Voice ID come from the persisted slots the
 * Keys drawer writes, so enabling voice anywhere enables it here.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { synthesizeSpeech } from '../ai/tts'
import { usePersistentApiKey } from './usePersistentApiKey'

export interface Tts {
  /** Synthesize and play `text`; rejects (and sets `error`) on failure. */
  speak: (text: string) => Promise<void>
  /** Stop and reset any current playback. */
  stop: () => void
  /** True from the moment synthesis starts until playback ends or is stopped. */
  speaking: boolean
  /** Last error message, or null. */
  error: string | null
  /** True when an ElevenLabs key is configured (so voice is offered at all). */
  available: boolean
}

export function useTts(): Tts {
  const key = usePersistentApiKey('elevenlabs')
  const voice = usePersistentApiKey('elevenlabs-voice')
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const cleanupUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    cleanupUrl()
    setSpeaking(false)
  }, [cleanupUrl])

  // Tear down on unmount.
  useEffect(() => stop, [stop])

  const speak = useCallback(
    async (text: string) => {
      if (!key.key) {
        setError('Add an ElevenLabs API key in Settings to enable voice.')
        return
      }
      const clean = text.trim()
      if (!clean) return
      stop()
      setError(null)
      setSpeaking(true)
      try {
        const blob = await synthesizeSpeech(key.key, clean, voice.key)
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        let el = audioRef.current
        if (!el) {
          el = new Audio()
          audioRef.current = el
        }
        el.onended = () => {
          cleanupUrl()
          setSpeaking(false)
        }
        el.src = url
        await el.play()
      } catch (e) {
        cleanupUrl()
        setSpeaking(false)
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [key.key, voice.key, stop, cleanupUrl]
  )

  return { speak, stop, speaking, error, available: Boolean(key.key) }
}
