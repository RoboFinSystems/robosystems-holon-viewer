/**
 * ElevenLabs text-to-speech, called directly from the browser (BYO key via the
 * `xi-api-key` header) — the same request shape the content-machine pipeline
 * makes server-side (`tools/generate_voiceover_audio.py`): the
 * `eleven_turbo_v2_5` model and the house voice settings.
 *
 * Dev uses a relative `/eleven` base so the request rides the Vite proxy (the
 * API's CORS aside); prod calls `api.elevenlabs.io` directly. Mirrors `mcp.ts`.
 */
const viteEnv = (import.meta as { env?: { DEV?: boolean } }).env
// Dev: relative → Vite proxy rewrites `/eleven` → api.elevenlabs.io.
// Prod: call ElevenLabs directly.
const BASE = viteEnv?.DEV ? '/eleven' : 'https://api.elevenlabs.io'

/** The default narrator voice — overridable per user via the Keys drawer. */
export const DEFAULT_VOICE_ID = 'GZ4PpFJV8ikEGUtBrjK7'

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

// Financial answers are full of `$` amounts. The voice's own normalizer chokes
// on a bare `$`/number next to the word "dollars" — it stresses "dollars" as a
// separate unit ("…thirty-four. DOLLARS."). So we spell the whole amount out to
// plain words *ourselves* ("$1,234,000" → "one million two hundred thirty four
// thousand dollars"); with no symbol or digit left, there's nothing for the
// normalizer to trip on and it reads as ordinary prose.
const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion']
const SCALE_ABBR: Record<string, string> = {
  k: 'thousand',
  m: 'million',
  bn: 'billion',
  b: 'billion',
  tn: 'trillion',
  t: 'trillion',
}

function threeToWords(n: number): string {
  const parts: string[] = []
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)], 'hundred')
    n %= 100
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)])
    n %= 10
    if (n) parts.push(ONES[n])
  } else if (n > 0) {
    parts.push(ONES[n])
  }
  return parts.join(' ')
}

/** A run of digits (no separators) → words, grouped in thousands. */
function intToWords(digits: string): string {
  const n = digits.replace(/^0+/, '')
  if (n === '') return 'zero'
  const groups: string[] = []
  let rest = n
  while (rest.length) {
    groups.unshift(rest.slice(-3))
    rest = rest.slice(0, -3)
  }
  const parts: string[] = []
  groups.forEach((g, i) => {
    const val = parseInt(g, 10)
    if (!val) return
    const scale = SCALES[groups.length - 1 - i] ?? ''
    parts.push(threeToWords(val) + (scale ? ` ${scale}` : ''))
  })
  return parts.join(' ')
}

function digitsToWords(s: string): string {
  return s
    .split('')
    .map((d) => ONES[Number(d)])
    .join(' ')
}

// "1,234" / "5.2" (+ optional scale) → fully spoken dollars.
function amountToWords(numStr: string, scaleWord?: string): string {
  const [intPart, decPart] = numStr.replace(/,/g, '').split('.')
  const intIsOne = parseInt(intPart || '0', 10) === 1

  if (scaleWord) {
    const scale = SCALE_ABBR[scaleWord.toLowerCase()] ?? scaleWord.toLowerCase()
    const dec = decPart ? ` point ${digitsToWords(decPart)}` : ''
    return `${intToWords(intPart)}${dec} ${scale} dollars`
  }

  const intWords = intToWords(intPart)
  // A 1–2 digit fraction is cents ("$10.50" → "…and fifty cents").
  if (decPart && decPart.length <= 2) {
    const cents = parseInt(decPart.padEnd(2, '0'), 10)
    if (cents === 0) return `${intWords} ${intIsOne ? 'dollar' : 'dollars'}`
    const centWords = intToWords(String(cents))
    const centUnit = cents === 1 ? 'cent' : 'cents'
    if (parseInt(intPart || '0', 10) === 0) return `${centWords} ${centUnit}`
    return `${intWords} dollars and ${centWords} ${centUnit}`
  }
  if (decPart) return `${intWords} point ${digitsToWords(decPart)} dollars`
  return `${intWords} ${intIsOne ? 'dollar' : 'dollars'}`
}

// Requires a digit after `$`, so cashtags like "$AAPL" are left alone.
const CURRENCY_RE =
  /\$\s?(\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|million|billion|trillion|bn|tn|[kmbt])\b)?/gi

function normalizeCurrency(text: string): string {
  return text.replace(CURRENCY_RE, (_m, num: string, scale?: string) => amountToWords(num, scale))
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
