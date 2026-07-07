/**
 * ElevenLabs text-to-speech, called directly from the browser (BYO key via the
 * `xi-api-key` header) — the same request the content-machine pipeline makes
 * server-side (`tools/generate_voiceover_audio.py`): the `eleven_turbo_v2_5`
 * model and the house voice settings, so spoken answers here match the videos.
 *
 * Dev uses a relative `/eleven` base so the request rides the Vite proxy (the
 * API's CORS aside); prod calls `api.elevenlabs.io` directly. Mirrors `mcp.ts`.
 */
const viteEnv = (import.meta as { env?: { DEV?: boolean } }).env
// Dev: relative → Vite proxy rewrites `/eleven` → api.elevenlabs.io.
// Prod: call ElevenLabs directly.
const BASE = viteEnv?.DEV ? '/eleven' : 'https://api.elevenlabs.io'

/** The content-machine "research narrator" voice — overridable per user. */
export const DEFAULT_VOICE_ID = '8Ln42OXYupYsag45MAUy'

const MODEL_ID = 'eleven_turbo_v2_5'
const VOICE_SETTINGS = {
  stability: 0.7,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
}

// Respell terms the model mispronounces — ported from content-machine's
// `normalize_for_tts` so both surfaces read them the same way. Audio only; the
// visible answer is untouched.
const TTS_SUBSTITUTIONS: Array<[RegExp, string]> = [[/\bEBITDA\b/gi, 'Ebit-dah']]

// Financial answers are full of `$` amounts, and the bare dollar sign trips the
// voice up ("dollars" comes out wrong or dropped). Rewrite `$` amounts into
// explicit spoken form — the number, its scale word, then "dollars" — so the
// currency reads cleanly. Scale abbreviations (k/m/bn/tn) are expanded too.
const CURRENCY_SCALES: Record<string, string> = {
  k: 'thousand',
  m: 'million',
  bn: 'billion',
  b: 'billion',
  tn: 'trillion',
  t: 'trillion',
}
// e.g. "$1,234.5 million" → "1,234.5 million dollars"; "$5" → "5 dollars";
// "$3.2bn" → "3.2 billion dollars". Requires a digit after `$`, so cashtags
// like "$AAPL" are left alone.
const CURRENCY_RE =
  /\$\s?(\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|million|billion|trillion|bn|tn|[kmbt])\b)?/gi

function normalizeCurrency(text: string): string {
  return text.replace(CURRENCY_RE, (_m, num: string, scale?: string) => {
    const word = scale ? ` ${CURRENCY_SCALES[scale.toLowerCase()] ?? scale}` : ''
    return `${num}${word} dollars`
  })
}

export function normalizeForTts(text: string): string {
  const substituted = TTS_SUBSTITUTIONS.reduce((t, [re, sub]) => t.replace(re, sub), text)
  return normalizeCurrency(substituted)
}

/**
 * Flatten Markdown to speakable plain text: drop code fences/inline backticks,
 * emphasis and heading markers, link syntax, and table pipes. Good enough for a
 * chat answer — not a full Markdown parser.
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^\s*[-*+]\s+/gm, '') // bullet markers
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/^\s*\|.*\|\s*$/gm, ' ') // table rows
    .replace(/[*_~]/g, '') // emphasis marks
    .replace(/\n{2,}/g, '. ') // paragraph breaks → sentence pause
    .replace(/\s+/g, ' ')
    .trim()
}

function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return 'Invalid ElevenLabs API key.'
    case 403:
      return 'This ElevenLabs key is not permitted to use text-to-speech.'
    case 404:
      return 'Voice not found — check the Voice ID in Settings.'
    case 422:
      return 'ElevenLabs rejected the request (unprocessable — check the Voice ID).'
    case 429:
      return 'ElevenLabs rate limit reached — try again in a moment.'
    default:
      return `ElevenLabs error (HTTP ${status}).`
  }
}

/**
 * Synthesize `text` to speech and return the audio as a Blob (audio/mpeg).
 * Throws an Error with a friendly message on failure.
 */
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voiceId?: string
): Promise<Blob> {
  const voice = voiceId?.trim() || DEFAULT_VOICE_ID
  const res = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(voice)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: normalizeForTts(text),
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
    }),
  })
  if (!res.ok) {
    // Error bodies are JSON; fall back to the status line if not.
    let detail = describeStatus(res.status)
    try {
      const body = (await res.json()) as { detail?: unknown }
      const d = body.detail
      if (typeof d === 'string') detail = d
      else if (d && typeof d === 'object' && 'message' in d) {
        detail = String((d as { message: unknown }).message)
      }
    } catch {
      // keep the status-derived message
    }
    throw new Error(detail)
  }
  return res.blob()
}
