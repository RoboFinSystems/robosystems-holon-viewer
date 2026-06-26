# Kickoff — build `robosystems-holon-viewer` + `@robosystems/report-components` **together**

Paste this into a fresh Claude Code session. These two repos are a **co-developed pair**: the **holon-viewer is the base app — the harness we implement the report components against.** Don't build the library in a vacuum and the app second; build them together, with the viewer exercising the components live.

Read both specs first: this repo's **`SPEC.md`** (the app) and **`../robosystems-report-components/SPEC.md`** (the library).

## The development model (read this before anything)

- Two repos, sibling dirs: `robosystems-holon-viewer` (this) and `../robosystems-report-components`.
- During co-dev, the viewer depends on the library via a **local link** — `"@robosystems/report-components": "file:../robosystems-report-components"` in this app's `package.json` (or `npm link`). A `file:` link alone requires a library **rebuild per change** (the slow part).
- **Make it feel instant** — alias the import straight to the library's **`src/`** during dev so the viewer's bundler transpiles it inline and **HMR works across both repos with no rebuild step**. In Vite: `resolve.alias` `'@robosystems/report-components' → '../robosystems-report-components/src'` (+ matching `tsconfig` paths); in Next: `transpilePackages` + a webpack alias. This is what makes the separate-repo setup feel like a monorepo. Build against the real `dist/` only in CI / before publish.
- **Sanctioned fallback (if the two-repo friction still isn't worth it this sprint):** inline the library _into this repo_ — develop the components under a local `src/report-components/` (or a workspace package), get the instant-feedback build sprint done, and **extract to `../robosystems-report-components` and publish later**. Keep the **framework-agnostic rule** (no `next/*`) even while inlined, so the extraction stays a _move_, not a rewrite. The decision point is purely DX — pick whichever gives faster feedback; the architecture (adapter seam, published package end-state) is identical either way.
- The components are built **greenfield in this harness** — the simplest consumer (a static viewer + the trig-file adapter) is the cleanest place to prove the API. Use the **RoboLedger app's existing statement rendering as a _reference for correctness_** (read it), not as code to extract first.
- Once the library is stable, **publish it** (its own OIDC release flow) and switch this app from the `file:` link to the published `^0.x`.
- The **RoboLedger app adopts the published package later** — a downstream migration (swap its welded renderer for the package), **not** a prerequisite here.

## The loop

1. **Viewer shell (the harness)** — framework (Vite + React default, or Next static export — SPEC §3), file-drop UI, RoboSystems branding. Get a runnable app up first.
2. **Library skeleton** in `../robosystems-report-components` — package + CI + the normalized report model + the adapter interface (its `PROMPT.md` covers the packaging). Link it into this viewer.
3. **Trig adapter + statement components** in the library, **exercised live by the viewer** against a real `.holon.trig`, until the four statements render and foot (e.g. `13,550 + 900 = 14,450 ✓`).
4. **Fact inspection** — click-a-fact panel + live in-browser foots-check.
5. **Mode B (SEC)** — the cypher adapter in the library + the API-key UI in the viewer (live SEC graph).
6. **Publish** the library; switch this app to the published version.

## Scaffolding for THIS app (an app, **not** an npm package)

It does **not** publish to npm — it builds static and deploys to **S3 + CloudFront**. Borrow _repo conventions_ from the templates, not the npm-publish flow.

- **Templates on disk**: `../robosystems-mcp-client`, `../robosystems-typescript-client` — for eslint(flat) + prettier + vitest, `.githooks/`, `.vscode/`, `.gitignore`, `LICENSE` (MIT, "RFS LLC"), `CLAUDE.local.md`, `bin/create-feature.sh`, and the `test.yml` + `claude.yml` workflows. The other RoboSystems **apps** are the reference for branding + the AWS static-deploy pattern (OIDC `AWS_ROLE_ARN`). Read the real files; don't guess.
- **`.github/workflows/`**: `test.yml` (install → `format:check` → `lint` → `test` → `build`); `claude.yml` (verbatim); **`deploy.yml`** — _new_, modeled on a RoboSystems app's deploy (build static → S3 sync → CloudFront invalidation), **deferred** until the bucket + distribution exist (provisioned via CloudFormation through the pipeline — never a direct CF deploy); a stub + TODO is fine for the first commit. **Do NOT** copy `publish.yml` / `create-release.yml` / `tag-release.yml`.
- **`bin/create-feature.sh`** + **`CLAUDE.local.md`** — copy verbatim from a template.
- **Tooling**: `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, vitest config, `.githooks/`, `.vscode/`, `.gitignore`, `tsconfig.json`, `LICENSE`.

### `package.json` (private, not published)

```jsonc
{
  "name": "robosystems-holon-viewer",
  "version": "0.1.0",
  "private": true, // <- app, never published to npm
  "type": "module",
  "scripts": {
    "dev": "vite", // or "next dev"
    "build": "vite build", // or "next build" (static export)
    "preview": "vite preview",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:all": "npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build",
    "feature:create": "./bin/create-feature.sh",
  },
  "dependencies": {
    "@robosystems/report-components": "file:../robosystems-report-components", // co-dev link; switch to "^0.1.0" once published
    "react": "^19",
    "react-dom": "^19",
  },
  "devDependencies": {
    /* vite (or next), typescript, @types/react, eslint stack, prettier, vitest, happy-dom — mirror the templates */
  },
  "engines": { "node": ">=18.0.0" },
}
```

No `publishConfig`, no `exports`, no `files`, no `release:create` — it's an app.

### App layout (per SPEC.md)

```
src/
  main.tsx                 # mount
  App.tsx                  # mode switch: file vs SEC
  modes/
    FileMode.tsx           # drag/drop a .holon.trig -> report-components' trig adapter -> render
    SecMode.tsx            # API-key input -> report-components' cypher adapter (live SEC graph) -> render
  components/
    FactInspector.tsx      # click-a-fact panel: element/period/unit + calc rule + live foots-check
  branding/                # RoboSystems design-system tokens / shell
```

## Working conventions

Follow `CLAUDE.local.md` in **both** repos: never commit on `main`; create branches only via `npm run feature:create`; the user runs `git push`, triggers deploys, and owns the library's release flow. Keep this app a **dumb static client** — the moment it grows a server of its own, it's lost the plot (SPEC §8).
