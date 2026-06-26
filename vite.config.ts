/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))

// Co-development: alias the package straight to the sibling library's `src/` so
// the viewer's bundler transpiles it inline — HMR works across both repos with
// no rebuild step. When the sibling isn't present (CI, or after switching to the
// published package), the alias is skipped and resolution falls back to the
// installed `@robosystems/report-components`.
const libSrc = resolve(here, '../robosystems-report-components/src')
const linkSrc = existsSync(libSrc)
const alias = linkSrc
  ? {
      '@robosystems/report-components/adapters': resolve(libSrc, 'adapters/index.ts'),
      '@robosystems/report-components': resolve(libSrc, 'index.ts'),
    }
  : {}

if (linkSrc) {
  // eslint-disable-next-line no-console
  console.log(
    '[holon-viewer] linking @robosystems/report-components → ../robosystems-report-components/src'
  )
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
  },
})
