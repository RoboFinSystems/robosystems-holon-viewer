/**
 * Speak text with ElevenLabs, managing a single audio stream for the session.
 *
 * Long text is chunked (`chunkForTts`) and pipelined: the next chunk is
 * synthesized while the current one plays, so an answer on the slow, high-
 * fidelity model starts speaking on its first chunk. Owns one
 * `HTMLAudioElement`: a new `speak()` (or `stop()`) abandons whatever pipeline
 * is running, and object URLs are revoked as they're replaced (and on unmount)
 * so blobs don't leak. The ElevenLabs key, optional Voice ID and the preset
 * (model / bitrate / settings) come from the persisted slots the Keys drawer
 * writes, so enabling voice anywhere enables it here.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { chunkForTts, synthesizeSpeech } from '../ai/tts'
import { usePersistentApiKey } from './usePersistentApiKey'
import { usePersistentVoicePreset } from './usePersistentVoicePreset'

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

/** A prefetched chunk's outcome — settled, never rejecting, so a failure surfaces where it is consumed. */
type Synthesized = { blob: Blob } | { error: unknown }

export function useTts(): Tts {
  const key = usePersistentApiKey('elevenlabs')
  const voice = usePersistentApiKey('elevenlabs-voice')
  const { preset } = usePersistentVoicePreset()
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  // Each speak() is a generation; stop() (or a newer speak) moves past it, so an
  // in-flight pipeline notices and abandons its remaining chunks.
  const generation = useRef(0)
  // Resolves the clip currently playing, so stop() releases a pipeline waiting on it.
  const releasePlay = useRef<(() => void) | null>(null)

  const cleanupUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    generation.current++
    const el = audioRef.current
    if (el) {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
    releasePlay.current?.()
    cleanupUrl()
    setSpeaking(false)
  }, [cleanupUrl])

  // Tear down on unmount.
  useEffect(() => stop, [stop])

  /** Play one clip to its end; resolves on `ended` (or on stop), rejects on a media error. */
  const play = useCallback(
    (blob: Blob) =>
      new Promise<void>((resolve, reject) => {
        cleanupUrl()
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        let el = audioRef.current
        if (!el) {
          el = new Audio()
          audioRef.current = el
        }
        const done = () => {
          releasePlay.current = null
          resolve()
        }
        releasePlay.current = done
        el.onended = done
        el.onerror = () => {
          releasePlay.current = null
          reject(new Error('Audio playback failed.'))
        }
        el.src = url
        el.play().catch(reject)
      }),
    [cleanupUrl]
  )

  const speak = useCallback(
    async (text: string) => {
      if (!key.key) {
        setError('Add an ElevenLabs API key in Settings to enable voice.')
        return
      }
      const clean = text.trim()
      if (!clean) return
      stop()
      const mine = generation.current
      setError(null)
      setSpeaking(true)
      const synthesize = (chunk: string): Promise<Synthesized> =>
        synthesizeSpeech(key.key, chunk, voice.key, preset).then(
          (blob) => ({ blob }),
          (e: unknown) => ({ error: e })
        )
      try {
        const chunks = chunkForTts(clean)
        let next = synthesize(chunks[0])
        for (let i = 0; i < chunks.length; i++) {
          const result = await next
          if (generation.current !== mine) return
          if ('error' in result) throw result.error
          if (i + 1 < chunks.length) next = synthesize(chunks[i + 1])
          await play(result.blob)
          if (generation.current !== mine) return
        }
        cleanupUrl()
        setSpeaking(false)
      } catch (e) {
        if (generation.current !== mine) return
        cleanupUrl()
        setSpeaking(false)
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [key.key, voice.key, preset, stop, play, cleanupUrl]
  )

  return { speak, stop, speaking, error, available: Boolean(key.key) }
}
