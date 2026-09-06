/**
 * Opening a holon by URL — `?url=https://…/holon.jsonld` — the link the
 * company pages and the filer catalog write. The browser fetches it, so the
 * host has to allow cross-origin reads (the public data CDN does).
 */

/** The holon named in the page's query string, or null when there is none or it is not a web URL. */
export function holonUrlParam(search: string): string | null {
  const raw = new URLSearchParams(search).get('url')
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/** The name shown for a holon opened by URL: its folder and file. */
export function holonUrlName(url: string): string {
  const parts = new URL(url).pathname.split('/').filter(Boolean)
  return parts.slice(-2).join('/') || url
}
