/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The RoboSystems API's CORS allowlist doesn't include localhost, so in dev the
// browser can't call it cross-origin. Proxy API paths through the dev server
// instead: the browser makes same-origin requests to localhost and Vite forwards
// them server-side (no CORS). SEC data is prod-only, so the default target is
// prod; override with VITE_ROBOSYSTEMS_API_URL. In dev the app uses a relative
// base URL (see src/sec/client.ts) so requests land here.
const apiTarget = process.env.VITE_ROBOSYSTEMS_API_URL || 'https://api.robosystems.ai'

export default defineConfig({
  plugins: [react()],
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
