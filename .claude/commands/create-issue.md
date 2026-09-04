---
description: Create a GitHub issue for the viewer, routed to the right layer.
argument-hint: '[what the issue is about]'
---

Create a GitHub issue for the current repository based on the user's input.

## Instructions

1. **Work out which layer owns it** - This is a static, client-side viewer for `holon.jsonld` reports. Three other repos sit around it, and most "the report looks wrong" bugs belong to one of them:
   - **The holon is wrong** — a fact is missing or has the wrong value in the document itself. That's `RoboFinSystems/xbrlkit` (the converter), or the source filing. Open the file and check the underlying facts before blaming rendering.
   - **The statement renders wrong** — the holon is correct but the table, subtotal, or dimensional breakdown is off. That's usually `RoboFinSystems/robosystems-report-components`, which owns the rendering. Fixing it here would be overwritten on the next version bump.
   - **SEC mode data** — the live graph returned something unexpected. That's `RoboFinSystems/robosystems`.
   - **Belongs here**: file loading, mode switching, the keys drawer, the AI agent and its SPARQL tools, in-browser query execution, voice, navigation, and the app shell.

2. **Determine Issue Type** - Pick one: **Bug**, **Task**, **Feature**, **RFC**, **Spec**. **This repo has no `.github/ISSUE_TEMPLATE/` directory** — confirm with `ls .github/ISSUE_TEMPLATE/` and structure the body yourself.

3. **Draft the Issue** - For a rendering bug, include: **which mode** (file or SEC), the filing (accession/CIK/period) or an attached holon, the **browser**, and actual vs expected. For an AI bug, include the question asked and the answer given — an answer that looks grounded and isn't is the failure mode worth reporting precisely.

4. **Sanitize** - This repo is public and the issue is world-readable immediately:
   - **Never paste an API key.** Users' Anthropic, ElevenLabs, and RoboSystems keys are entered in the browser, so console output and HAR files attached to an issue are the likely leak. Scrub `Authorization` headers before attaching anything.
   - SEC filing content is public data, so holons and filing fragments are fine to attach.
   - No internal infrastructure detail.

5. **Create the Issue**:

   ```bash
   gh issue create --title "<title>" --body-file /tmp/issue-body.md
   ```

## Labels

```bash
gh label list --limit 100
```

This repo carries only GitHub's stock labels — no `area:*` / `priority:*` / `size:*` families, and `gh issue create` fails on a label that doesn't exist.

## Output Format

1. The issue URL
2. Brief summary of what was created
3. Which layer you concluded owns it, and whether it should be filed against xbrl-holon or report-components instead

$ARGUMENTS
