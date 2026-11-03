# Senda agent-contract execution boundary

This change keeps **agentic planning** active, but requires an explicit roster **Sign** click before any wallet-signing path runs. A 20-second book/tape tick can still update plans, queues, logs, and research; it can never open Phantom or send a queued trade by itself. The "Read it" natural-language trade form queues for review instead of triggering a surprise signing prompt.

At signing time, the client reloads the current contract rather than trusting a stale UI snapshot. It checks: armed state; an existing queue; action, order, side and approved symbol; trigger-price identity; the remaining lifetime contract budget; the current wallet spending cap; the daily-job limit; and a fixed payment recipient and USDC denomination. Swap execution uses only the exact queued symbol, with no silent fallback to another market. A successful submitted action updates the local contract's consumed budget.

## Important production boundaries

Contract spending totals and approvals currently live in **browser localStorage**. They can be edited, cleared or duplicated across browsers/tabs, so they are not a cryptographic spending allowance or enforceable autonomous trading authority. A provider signature and backend policy ledger, plus on-chain settlement reconciliation and concurrency control, are required for a truly unattended agent. The wallet still signs every action.

The USDC payment path currently reports transaction submission, not independent confirmed settlement; budget is conservatively consumed after submission to discourage duplicate attempts. Reconcile uncertain signatures before retrying.

Targeted tests: `node --test scripts/agent-approval.test.mjs`. Run the full typecheck, tests and production build in a checkout before merging. No trades or transfers were executed by this patch.
