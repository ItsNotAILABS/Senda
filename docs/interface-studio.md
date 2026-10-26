# Senda Interface Studio — design operations board

Senda's UI redesign work now has a **first-class** `/work/interface` board under Work and UI Studio navigation. The purpose is to make a large production trading interface reviewable without inventing completed work.

## Shipped in this branch
- Screen inventory tracks 13 current or planned product surfaces. Genesis is explicitly labeled as a separate unmerged PR, not a live route on `main`.
- 12 starter design tasks are all `To design`, not fake in-progress/released items.
- Kanban stages: `To design`, `In progress`, `In review`, `Ready for merge`. Drag-and-drop is intentionally not required; keyboard-friendly stage selectors work.
- Every task has an owner, priority, screen, description, acceptance criteria, notes, and optional matching Senda PR URL. Readiness requires all five self-reported checks: laptop, phone, accessibility, finance-truth, and build evidence. A ready task is **not** a deployment or code merge.
- Search, filter, screen overview, responsive layout sandbox, four color presets, safe custom hex accent, local browser preview, JSON import/export and agent-task clipboard briefs.
- Theme presets override only allowlisted design variables and never interact with wallet keys, trade execution, RPC authorization, portfolio balances, or on-chain state.

## User-visible limitations
- Board data and appearance drafts use `localStorage` **on that device**. Import/export is explicit; the board does not synchronize accounts or collaborators. Editing a task does not change code in GitHub.
- Theme preview is a *local override* for this browser, not a live deployment for all visitors. Turning it off restores the site's styles. A proper design system rollout still needs a separate reviewed PR.
- The layout sandbox uses labeled placeholders, **not** live price/volume/order/portfolio feeds. Use `Open app screen` for the real production route in a new tab.
- "Copy agent mission" prepares a reviewed task description. It cannot start autonomous work or merge changes. There is no secret GitHub token or arbitrary remote command runner in the site.

## Release procedure
1. Pick a screen, write acceptance criteria, and assign a responsible reviewer.
2. Create a *separate* implementation branch, touch only the relevant components and shared design tokens, and attach a Senda PR URL.
3. Run `npm run typecheck` and `npm run build:dev`. On wallet/trading screens also verify signer prompt, quote provenance, no synthetic balances, pending receipt, and failed RPC states.
4. Inspect laptop and mobile, keyboard focus, contrast, touch targets and accessibility. Attach real screenshots/test receipts to PR.
5. Check the five gates and move to `Ready for merge`. Do **not** equate a checked box with CI proof; verify the PR independently.
6. Merge/deploy through the existing authorized environment and verify public `https://senda.pocketnova.app` only after deployment.

## Tests
```sh
node --test scripts/interface-board.test.mjs scripts/interface-theme.test.mjs
npm ci
npm run typecheck
npm run build:dev
```

The seeded board and its checks are meant to be a truthful review workflow, not a record of shipped interface work.
