# RoboSystems Holon Viewer

A static, client-side renderer for `holon.trig` financial reports — the analog of
Arelle's `ixbrl-viewer`. A `holon.trig` is a portable RDF artifact, not
self-rendering HTML, so this app reconstructs the statements from the graph and
adds interactive fact inspection.

**Live:** [holon.robosystems.ai](https://holon.robosystems.ai) · **Design:** [`SPEC.md`](./SPEC.md)

## Modes

- **File** — open a local `holon.trig` and render it. Offline, no key, no backend.
- **SEC** _(coming soon)_ — connect to the live SEC graph with your own API key and
  pull a company's report, rendered by the same components. The call is client-side;
  still no app backend.

## How it works

Rendering isn't in this app — it comes from
[`@robosystems/report-components`](https://github.com/RoboFinSystems/robosystems-report-components),
the source-agnostic library shared with the other RoboSystems apps. This repo is the
shell around it: the file-drop / SEC-connect UX, fact inspection, and branding.

A Vite + React + TypeScript SPA that builds to pure static files (hosted on
S3 + CloudFront) — no backend at runtime.

## Development

```bash
npm install      # dependencies
npm run dev      # dev server
npm run build    # static build → dist/
npm run preview  # preview the production build
npm run test:all # format:check + lint + typecheck + test + build
```

## License

MIT — see [`LICENSE`](./LICENSE).
