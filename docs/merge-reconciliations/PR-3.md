# Senda legacy PR #3 reconciliation

Status: **historical merge with current-main content retained**, not a claim that every original change was adopted.

- Historical PR head: `2fbf15d7d1dbf84f5f11d38a19edc0f1105c210c`
- Reconciliation base: `b1a662b5e0832b3cbfa61bdd92c08781049f6c7f`
- Original scope: Jupiter wallet hardening, quote protection, confirmation and recovery
- Already carried forward: #5 and #24 and current main transaction journal, official Jupiter host and signer locks
- Intentionally excluded: older quote guard's weaker minimum-output enforcement, stale signer and payment flow overrides
- Merge resolution: preserve the existing main tree for all old files and append this receipt. Do not rewrite the current UI, wallet signature, execution authority, transaction journal or installed product configuration.
- Validation: GitHub Actions runner unavailable in inspected workflows, local repository checkout unavailable due blocked network. No green test/build, live swap, deployment, or on-chain settlement asserted.
- Any unported original code must be reviewed in a separate scoped PR with reproducible tests. The original commits remain in Git ancestry, but superseded content is not reintroduced into the active app.
