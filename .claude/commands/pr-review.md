---
description: Review a pull request — gather metadata, diff, and existing feedback, then give a verdict.
argument-hint: '[pr-number-or-url]'
---

Review a pull request by gathering all PR metadata, diff, and review comments, then provide a comprehensive review summary.

## 1. Identify the PR

URL, number, or detect from the current branch with `gh pr view --json number,url`. If none, ask.

## 2. Gather PR Data

```bash
gh pr view <NUMBER> --json number,url,title,body,author,state,isDraft,labels,comments,reviews,reviewDecision,latestReviews,statusCheckRollup,mergeStateStatus,headRefName,headRefOid,baseRefName,additions,deletions,changedFiles,files,closingIssuesReferences,createdAt,updatedAt

gh pr diff <NUMBER>

gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/<NUMBER>/comments --paginate
```

- `reviews` not `reviewers`; `reviewDecision` answers "approved?"; `comments` covers the conversation.
- Keep `--paginate` **bare** — `-q`/`--jq` makes gh emit one document per page.

## 3. How feedback actually arrives here

- Formal reviews and inline comments are usually **empty**, `reviewDecision` blank. That's the norm.
- **AI review is opt-in** — `claude.yml` fires only on an `@claude` mention from an `OWNER`/`MEMBER`/`COLLABORATOR`.
- CI runs the gate; `NEUTRAL`/`SKIPPED` are not failures.
- **What CI cannot see: anything that requires loading a report.** Rendering, the keys drawer, in-browser SPARQL, and the AI agent are only exercised by a human opening a holon. Green CI is a weak signal here.

## 4. Review the Diff

- **Key handling first.** Users enter their own Anthropic, ElevenLabs, and RoboSystems keys on the promise that they stay in the browser and reach no app backend (there isn't one). Does the diff add **any** outbound call, log line, error reporter, analytics hook, or dependency with access to page state? Name every destination; a key reaching anywhere the user didn't knowingly authorize is the worst bug this app can ship, and it is a blocking finding.
- **File mode offline guarantee**: opening a local holon must make no network call. A new fetch on that path breaks a stated promise.
- **Rendering output**: does a displayed value, subtotal, or dimensional breakdown change? Users read these as financial statements.
- **Right repo**: statement rendering lives in `@robosystems/report-components` and conversion in `xbrlkit`. A patch here over either gets overwritten or masks the real bug — flag it.
- **Client-side SPARQL**: is a new query bounded, or can a large report hang the tab?
- **AI grounding**: does the agent's answer actually come from SPARQL results over the loaded report, rather than from the prompt? A confidently ungrounded answer is worse than a refusal.
- **Build**: this ships as a static bundle with no server — a build-time mistake has no runtime fix.
- **Dependencies**: on a keys-in-browser app, a new dependency is a credential-exposure question, not just bundle size.
- **Tests**: read them; one asserting current behavior passes as happily as one asserting correct behavior.

## 5. Output Format

```
## PR Summary
**Title**: ... | **Author**: ... | **Branch**: ... → ...
**Status**: ... | **Changes**: +X / -Y across Z files

## Key Handling
<NO CHANGE / TOUCHED — and if touched, every destination the change can reach>

## Existing Review Feedback
### Human Reviews / AI Reviews / Code Quality / Security / CI Status

## My Review
### Issues (should fix before merge)
### Suggestions (non-blocking)
### Questions

## Verdict
<APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION — with brief rationale>
```

### Notes

- Weight key handling and the offline guarantee above everything else
- Ask whether the author actually loaded a report; CI can't tell you
- If the PR references an issue (`closingIssuesReferences`), check the requirements are met

$ARGUMENTS
