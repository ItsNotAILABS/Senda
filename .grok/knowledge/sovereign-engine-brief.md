# Sovereign Engine — knowledge only (do not implement the engine)

Source: github.com/FreddyCreates/sovereign-engine @ b35efa9 (main).
Read this. Do **not** clone, port, or work on the engine itself.

## What it is

Autonomous enterprise OS / six-core fintech substrate. Shipaton 2026
packaging. Python. Double-entry GL is the invariant every core posts to.

## Six cores (all post to GL)

| Core | Job | Math |
| --- | --- | --- |
| XFIN | FX micro-settlement | Black-Scholes-Merton IRP |
| AURA | Bayesian underwriting / BNPL | logistic PD |
| PULSE | Churn / LTV elasticity | Cox hazard, Kuramoto R |
| MINT | Deflationary tokenomics | φ bonding, φ−1 = 0.618 |
| GRID | IoT BFT mesh | hardware quorum |
| NEXS | Paywall AST compiler | UCB1 bandit |

## Ledger invariant (the only thing PIT should steal)

State vector S_t ∈ R^n. Σ debits = Σ credits. Variance must print $0.00.

Chart of accounts used in the README:

- 1010 Operating Cash
- 4010 Subscription Revenue
- 5010 Merchant Fees

RevenueCat example posting:

```
Dr 1010 Operating Cash     85
Dr 5010 Merchant Fees      15
Cr 4010 Subscription Rev  100
variance                   0
```

## genesis.json (token, not a market)

- native token FORMA, 1e9 supply, 8 decimals
- compounding_rate_phi = 1.618033988749895
- chain_id parallax-sovereign-chain-1
- block_time_ms 873, phi_harmonic_scaling true

## monetization_markets_engine.py — NOT prediction markets

It is RevenueCat IAP packaging + Catvertising + a **fake MasterCard
virtual card** (`5412-7500-4820-…`) + Brex/Ramp ad nodes.

**Do not copy.** No virtual cards, no Catvertising, no credit-card
recommenders, no `$rc_monthly` paywalls, no pretend card PANs.

## What does not exist in the repo

No LMSR. No AMM. No prediction markets. No casino / table-game UX.
`monetization_markets` is a naming collision — IAP, not betting.

## Agent rules from the repo AGENTS.md

- Production-grade, no fluff
- No hypothetical scale metrics (no "12k subscribers")
- Empirical verification
