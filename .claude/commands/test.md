---
description: Run the full test and code-quality gate, fixing failures to green.
argument-hint: '[test-path]'
---

Run `npm run test:all` and systematically fix all failures to achieve 100% completion.

## Strategy

1. **Run the full gate first**, filtering for signal (below).
2. **Fix in the order it runs**: `format:check` → `lint` → `typecheck` → `test` → `build`. It's an `&&` chain and short-circuits.
3. **Iterate on the failing layer only** — `npx vitest run <path>` is the fastest loop.
4. **Stop when green.** Don't re-run to "confirm."

## What `npm run test:all` runs

```
npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build
```

**This gate is check-only — it does not auto-write.** Unlike the RoboSystems apps, a formatting failure here needs an explicit `npm run format` / `npm run lint:fix` and a re-stage. The upside: it matches the pre-commit hook exactly.

`build` is part of the gate on purpose. This app ships as a **static bundle with no server**, so a build-only failure is a shipping failure with no runtime fix available.

## Output Handling

```
npm run test:all 2>&1 | grep -E "Test Files|Tests |FAIL|✗|×|error TS|✖|Error:" | tail -30
```

Success = a `Test Files ... passed` line, no failure markers, **and** the build completing — the build runs last, so a tail ending mid-build is not a pass.

## Notes

- Vitest uses `✓` for pass and `✗`/`×` for fail, plus a `FAIL` prefix for files containing failures.
- **Unit tests can't cover the thing most likely to break.** This is a browser app with no backend: rendering, the keys drawer, in-browser SPARQL, and the AI agent are exercised by loading an actual report. After a green gate, open a holon in `npm run dev` and look.
- **File mode must stay offline.** If you changed anything near loading, verify with the network throttled to offline — no test asserts that guarantee.
- Rendering failures often belong to `@robosystems/report-components`, not here. Fixing them locally gets overwritten on the next version bump.
- Sample holons come from `xbrlkit` (`xbrlkit build …`) if you need a specific filing shape.

## Goal

100% pass on `npm run test:all`, plus a real look at a rendered report for anything user-facing.

$ARGUMENTS
