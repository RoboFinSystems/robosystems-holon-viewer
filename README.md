# robosystems-holon-viewer

A standalone, static-hosted financial-report renderer for `holon.trig` — the
analog of Arelle's `ixbrl-viewer`, but for holon reports. A `holon.trig` is a
portable RDF artifact (TriG named graphs), not self-rendering HTML; this app is
the missing view that reconstructs the financial statements from the graph and
adds interactive fact inspection.

> **Status: in development.** See [`SPEC.md`](./SPEC.md) for the full design.

## Two modes

- **Mode A — file (offline, zero-auth)**: open a local `holon.trig` and render
  it. No network, no key, no backend.
- **Mode B — SEC (live, bring-your-own API key)**: supply an API key, connect to
  the live SEC graph, and pull down a company's report. The authenticated call
  is made client-side — there is still no app backend.

Either way the app is a dumb static client with **no backend of its own** — it
builds to static files for hosting on S3 + CloudFront.

## Rendering lives in the library

This app does **not** implement report rendering. All rendering comes from
[`@robosystems/report-components`](https://github.com/RoboFinSystems/robosystems-report-components),
the source-agnostic library shared by this viewer and the other RoboSystems
apps. This repo is just the shell + UX: the file-drop / SEC-connect flows, the
fact-inspection panel, branding, and the static-hosting story. During co-dev the
component package is consumed via a local `file:` link and switches to the
published version once the library is stable.

## Tech

Vite + React + TypeScript SPA. Pure static output; the component package is a
build-time dependency bundled into the build — no npm / node / server at runtime.

## Development

```bash
npm install        # install dependencies
npm run dev        # start the Vite dev server
npm run build      # build static files into dist/
npm run preview    # preview the production build locally
```

### Checks

```bash
npm run format:check   # prettier --check
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run test           # vitest run
npm run test:all       # format:check + lint + typecheck + test + build
```

### Branching

Create feature branches only via the helper (never by hand):

```bash
npm run feature:create feature my-branch-name
```

See [`CLAUDE.local.md`](./CLAUDE.local.md) for the working conventions and
[`BRANDING.md`](./BRANDING.md) for the RoboSystems fonts, logos, and color
palette.

## License

MIT — see [`LICENSE`](./LICENSE). Private; not published to npm.
