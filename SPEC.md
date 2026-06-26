# `robosystems-holon-viewer` — a standalone financial-report renderer for `holon.trig`

**Status**: Design — not yet built.

A dedicated, lightweight React app (the analog of Arelle's `ixbrl-viewer`) that renders financial reports in **two modes**:

- **Mode A — file (offline, zero-auth)**: open a local `holon.trig` and render it. No network, no key, no backend.
- **Mode B — SEC (live, bring-your-own API key)**: connect to the live SEC graph and pull down a company's report.

Either way the app has **no backend of its own** — it is static-hosted. It consumes [`@robosystems/report-components`](https://github.com/RoboFinSystems/robosystems-report-components) for all rendering; this app is just the shell + UX.

---

## 1. Why a renderer is needed

A `holon.trig` is a clean, portable, queryable artifact — but it is **not self-rendering**. It is RDF (TriG named graphs), not HTML, so there is no way to _view_ a holon report without reconstructing the statements from the graph. You can query it (with rdflib/SPARQL) but you cannot look at it. This app is that missing view: feed it a holon and it renders the financial statements, with interactive fact inspection.

A property that falls out for free: the viewer renders **only what's in the holon** — scene + boundary + projection, never an underlying ledger (the event graph isn't in a report holon). So it **structurally cannot surface the books** — the access boundary holds automatically, with no enforcement code.

## 2. The architectural difference from `ixbrl-viewer`

The Arelle `ixbrl-viewer` (Apache 2.0, client-side) gets the hard part for free: **iXBRL is already self-rendering HTML.** The report renders itself; the viewer merely _augments_ it with an interactive fact-inspection layer.

**A holon is pure RDF — not self-rendering.** So this viewer must do strictly more: **reconstruct** the statements from the named graphs (scene values + projection presentation order + boundary subtotals → the tables) **and then** add interactivity. The iXBRL viewer skips the reconstruct step; this one can't.

The mitigant: the reconstruction algorithm already exists in the RoboSystems platform (the DataBook converter — presentation-order walk, calc subtotals, IB table render) and is shared, source-agnostic, via `@robosystems/report-components`. This app does not reimplement rendering — it supplies a data source and a UI shell.

## 3. The design

A **lightweight, client-side SPA** with **no backend of its own.** Framework is a toolchain-uniformity-vs-footprint call: **Next.js static export** keeps it identical to the other RoboSystems apps (one CI/deploy/mental-model); **Vite + React** is the leaner fit for something with no SSR or routing. Either builds to pure static files; the framework-agnostic components work under both.

- **Mode A — file**: drop/point at a `holon.trig` → the library's **N3.js** trig adapter parses TriG + named graphs into a quad store and emits the normalized report model → the shared components render it. No network, no key, no backend.
- **Mode B — SEC**: the user supplies an API key → the library's **cypher/GraphQL** adapter pulls a company's report from the **live SEC graph** → the _same_ components render it. Still no app backend — the app makes the authenticated API call **client-side**; it just isn't _zero-auth_ in this mode (the key is user-supplied, not app-managed).
- **Interactive MVP**: click a fact → its element / period / unit, the calculation rule it participates in, and the subtotal footing **live** (e.g. `13,550 + 900 = 14,450 ✓`, computed in-browser).
- **Optional later**: an ad-hoc SPARQL query box over a loaded trig — _then_ add a JS SPARQL engine (Comunica over the N3 store, or Oxigraph → WASM). Not needed for the render MVP.
- **Hosting**: build → static files → **S3 + CloudFront**. The component package is a **build-time** dependency, bundled into the static output — the deployed site is pure static with no npm / node / server at runtime.
- **Branding**: shares the RoboSystems design system.

## 4. This app is one consumer of `report-components`

The render logic is **not** in this app — it lives in `@robosystems/report-components`, the source-agnostic library this viewer, the RoboLedger app, and any future SEC explorer all share. This viewer is the library's rendering layer with operations stripped out and the two read-only adapters (trig-file + SEC-cypher) bolted on. See that repo's `SPEC.md` for the adapter seam, the framework-agnostic rule, and the npm-publish model.

What's left for **this** repo is just the app: the file-drop / SEC-connect UX, the fact-inspection panel, branding, and the static-hosting story (§3).

## 5. Boundary with the RoboLedger app (what _not_ to build here, and there)

The RoboLedger app's identity is **operate on a live general ledger** — render from the source of truth, then close / map / edit on top. It should **not** grow an open-ended "paste any holon.trig and view it" feature — that dilutes its identity and creates ambiguity about which data is authoritative (live ledger vs. pasted file). A stateless file-viewer doesn't belong inside a stateful operational app.

So: RoboLedger stays operational; **this viewer owns arbitrary-file rendering**. RoboLedger may link out to this viewer for "view this published snapshot," but never hosts the file-input itself.

## 6. Naming

The repo is **`robosystems-holon-viewer`** — `robosystems-` prefix to match the rest of the ecosystem. "Holon" is apt even in SEC mode: the app views **holon-shaped reports** regardless of source — a `.trig` file _or_ a report materialized live from the graph. The generic, source-agnostic name is reserved for the _library_ (`report-components`); the app is named for what it renders.

## 7. The `holon.trig` it renders

Three named graphs under the report IRI: `<report>#scene` (facts + Information Blocks + elements/periods/units/entity), `<report>#boundary` (the calculation network), `<report>#projection` (the presentation network + structures). There is no event/ledger graph — the books are never published in a report holon. Full format detail lives in the `report-components` SPEC (§6) and the trig file adapter.

## 8. Out of scope

- **Pivot / full-text search / Excel export / on-the-fly graphs** — the richer interactive layer; defer.
- **A server-side SPARQL-over-holon tool** — the _query_ half of portable-holon tooling; a separate build.
- **An XBRL-zip → holon converter for SEC.** SEC reads go through the live cypher adapter; converting filings to `holon.trig` has no current use case.
- **An app backend, app-managed auth, or server-side state.** Static-hosted, period. The SEC mode's API key is user-supplied and the call is client-side — that's not an app backend.

## 9. Phasing

This app is the **harness** the library is built against — they're co-developed, not sequenced. During development the viewer links the library locally (`file:../robosystems-report-components`); it switches to the published version once the library is stable.

| Phase                      | Work                                                                                                                                                                                                                                  | Notes                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **1 — app shell + Mode A** | The SPA (Next.js static export _or_ Vite + React): drop-a-file UI → library's N3.js trig adapter → shared components render → static build to S3+CF. **The components grow here, exercised by this app** (see the library's SPEC §5). | The harness + the standalone artifact. No SPARQL engine needed for render. |
| **2 — Mode B (SEC)**       | API-key input → library's cypher adapter pulls a company from the live SEC graph → same components render.                                                                                                                            | Client-side authed call; no app backend. Proves source-agnosticism.        |
| **3 — fact inspection**    | Click-a-fact details (element/period/unit + the calc rule) and live foots-check.                                                                                                                                                      | The "dig into details" MVP.                                                |
| _deferred_                 | search / export / graphs / pivot; SPARQL query box.                                                                                                                                                                                   | The "pivotable, sharable" extensions.                                      |
