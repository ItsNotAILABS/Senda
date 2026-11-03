# Senda perpetual agent learning loop (governed)
The nightly GitHub Actions job is **not a live 24-hour agent**. It executes on GitHub's schedule only after this workflow reaches the default branch and Actions are enabled. It cannot access browser `localStorage` or your laptop. Its input is only exported, source-controlled or supplied JSONL receipts under `ops/agent-logs/*.jsonl`.

A receipt has `{"at":"2026-10-23T12:00:00Z","agentId":"name","message":"..."}` fields. The loop hashes lines to reference provenance, detects recurring error patterns with a minimum of three observed instances, and produces `artifacts/skill-proposals/YYYY-MM-DD/report.json` and optional `PROPOSED_SKILLS.md`.

It does **not** train model weights, install ChatGPT skills, change trading code, write to wallets, or merge pull requests. Empty logs produce an explicit no-data receipt, not an invented improvement. Proposed skills require a human to review evidence, implement deterministic checks, run CI, and separately approve installation or deployment. Real overnight learning requires an authenticated log ingestion service and isolated sandbox worker; this PR intentionally does not invent those services.
