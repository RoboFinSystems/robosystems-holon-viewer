---
description: Open a pull request for the current branch, writing the description from the work actually done.
argument-hint: '[target-branch] [review]'
---

Create a GitHub pull request for the current branch, writing the title and description from the actual work done in this session — not reconstructed from the diff.

## Why this command exists

A description written from the diff alone can't know _why_ a change was made, so it tends to describe things that aren't true. **You author it here, where the full context is available.**

This is the **Holon Viewer** — a static, client-side React/Vite renderer for `holon.jsonld` reports, deployed as a bundle behind CloudFront. **There is no backend**, and users supply their own Anthropic, ElevenLabs, and RoboSystems API keys in the browser. **This repository is public.**

## Instructions

### 1. Preflight

```bash
CURRENT=$(git branch --show-current)
TARGET=${1:-main}
```

- **Never PR from `main`.** Branches come from `npm run feature:create`, not `git switch -c`.
- **Source ≠ target.** Stop if equal.
- **Uncommitted changes**: surface them and ask whether to commit (never on `main`, stage by name, no `git add -A`).
- **Existing PR**: `gh pr list --head "$CURRENT" --base "$TARGET" --json url,number` — offer `gh pr edit` rather than duplicating.
- **Push**: `git push -u origin "$CURRENT"`.

### 2. Gather the real change context

Use this session as the primary source; corroborate with `git log`, `git diff --stat`, and the full `git diff`. **No confabulation** — every claim must be supported by the diff.

### 3. Compose the PR

- **Title** — conventional-commit style with a scope, matching `git log`.
- **Body** — **match the headings in `.github/PULL_REQUEST_TEMPLATE.md`**, since `--body-file` bypasses template prefill and silently drops omitted sections:
  - **Summary** — 1–3 sentences.
  - **Changes** — grouped by area: report rendering, modes (file/SEC), keys drawer, AI + SPARQL, voice, app shell.
  - **Key Handling** — the section that matters most here. "No change" if the diff doesn't touch key storage, transport, or any outbound request. Otherwise name **every** destination the change can send data to, and confirm each is a provider the user knowingly supplied a key for.
  - **Testing** — the gate is `npm run test:all` (`format:check` → `lint` → `typecheck` → `test` → `build`), and it's check-only. Say whether you actually **loaded a report** — unit tests don't cover rendering, and file mode's offline guarantee isn't asserted anywhere.

  Put `Closes #123` as the last line of the Summary.

- **Say if rendering output changed.** A different value, subtotal, or dimensional breakdown is what users read as a financial statement. Note that most statement rendering lives in `@robosystems/report-components` — if the fix belongs there, say so rather than patching locally, since a local patch is overwritten on the next bump.

- **Say if file mode's offline guarantee is affected.** Opening a local holon must make no network call. Any new fetch on that path is a stated-promise break, not an optimization detail.

- **Attribution** — attribute to the user only; no Claude footer or trailer unless explicitly asked.

### 4. Create the PR

```bash
gh pr create --base "$TARGET" --head "$CURRENT" --title "<title>" --body-file /tmp/pr-body.md
```

### 5. Optional Claude review

Only if the user asks (`review` / `--review`): `gh pr comment <number> --body "@claude please review this PR"`.

## Output

1. PR URL. 2. Title. 3. Target ← source. 4. Whether key handling or the offline guarantee is affected. 5. Whether a review was requested.

$ARGUMENTS
