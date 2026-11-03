# Conflict resolution for legacy Senda PR #9

- Original head: `b57d5a201271166cbab581b737ee09d2e5277c0e`
- Reconciled against `main`: `a885b8b7cd0a843447861ccd6f5ab54d71a8b4e0`
- Historical PR intent: Interface Studio, browser-local review board, appearance previews.
- Functional carry-forward: PR #23 added the isolated `/work/interface` route, review board, tests and Work link.
- Conflict decision: preserve the exact current main tree for all pre-existing files. Do not reapply old global `app-shell.tsx` event listeners, `src/styles.css` overrides or navigation replacements.
- This resolution merge records the legacy PR history and a reconciliation receipt; it does **not** claim to activate any excluded changes.
- Runtime verification: GitHub Actions runner unavailable; no green build asserted.
