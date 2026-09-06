import { describe, expect, it } from 'vitest'
import { holonUrlName, holonUrlParam } from '../src/modes/openUrl'

const CDN = 'https://public.robosystems.ai/2025/0001045810/0001045810-25-000023/holon.jsonld'

describe('holonUrlParam', () => {
  it('reads the holon URL the catalog links with', () => {
    expect(holonUrlParam(`?url=${encodeURIComponent(CDN)}`)).toBe(CDN)
  })

  it('is null without the parameter', () => {
    expect(holonUrlParam('')).toBeNull()
    expect(holonUrlParam('?other=1')).toBeNull()
  })

  it('opens web URLs only', () => {
    for (const bad of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/plain,hi',
      'not a url',
    ]) {
      expect(holonUrlParam(`?url=${encodeURIComponent(bad)}`), bad).toBeNull()
    }
  })
})

describe('holonUrlName', () => {
  it('names the holon by its filing folder and file', () => {
    expect(holonUrlName(CDN)).toBe('0001045810-25-000023/holon.jsonld')
  })

  it('falls back to the URL when there is no path', () => {
    expect(holonUrlName('https://example.com/')).toBe('https://example.com/')
  })
})
