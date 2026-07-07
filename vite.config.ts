/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The RoboSystems API's CORS allowlist doesn't include localhost, so in dev the
// browser can't call it cross-origin. Proxy API paths through the dev server
// instead: the browser makes same-origin requests to localhost and Vite forwards
// them server-side (no CORS). SEC data is prod-only, so the default target is
// prod; override with VITE_ROBOSYSTEMS_API_URL. In dev the app uses a relative
// base URL (see src/sec/client.ts) so requests land here.
const apiTarget = process.env.VITE_ROBOSYSTEMS_API_URL || 'https://api.robosystems.ai'

// Opt-in local link to a sibling checkout of @robosystems/report-components:
// `VITE_LOCAL_REPORT_COMPONENTS=1 npm run dev` resolves the package (and its
// /adapters subpath) to ../robosystems-report-components/dist so unpublished
// render changes can be exercised against live SEC data. Requires a fresh
// `npm run build` in that repo. Off by default, so CI/prod builds are unaffected.
const useLocalRC = process.env.VITE_LOCAL_REPORT_COMPONENTS === '1'
const rcDist = (p: string): string =>
  fileURLToPath(new URL(`../robosystems-report-components/dist/${p}`, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // A single React instance across the app and the (aliased) local package.
    dedupe: ['react', 'react-dom'],
    alias: useLocalRC
      ? [
          {
            find: '@robosystems/report-components/adapters',
            replacement: rcDist('adapters/index.js'),
          },
          { find: '@robosystems/report-components', replacement: rcDist('index.js') },
        ]
      : [],
  },
  // Don't pre-bundle the aliased local build — pick up rebuilds without cache.
  optimizeDeps: useLocalRC ? { exclude: ['@robosystems/report-components'] } : undefined,
  server: {
    proxy: {
      '/v1': { target: apiTarget, changeOrigin: true, secure: true },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
  },
})
