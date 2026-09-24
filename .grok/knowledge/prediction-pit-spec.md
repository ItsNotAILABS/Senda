# The PIT — prediction markets as a table-side casino

Gamified online **table-game pit**. Not a Polymarket dashboard. Not blackjack.
Not the Sovereign Engine. Simulated chips only.

## Feel

You walk into a pit. Four felt tables. A cage window. Chip rail. You sit a
table, size a stack, drop chips on YES or NO. The house is an LMSR market
maker sitting in the dealer spot. Odds breathe. Other seats click chips
(seeded house bettors, not fake user counts).

Always visible: **SIMULATED CHIPS · NOT REAL MONEY**.

## LMSR (Hanson)

Binary market, outcomes YES / NO.

```
C(q) = b * ln(exp(q_yes / b) + exp(q_no / b))
p_yes = exp(q_yes / b) / (exp(q_yes / b) + exp(q_no / b))
cost(Δ) = C(q + Δ e_i) - C(q)
payout if i resolves = Δ chips (share = 1 chip at resolution)
```

- `b` liquidity. Default `b = 100 * φ` with φ = 1.618033988749895.
- Reject bets the player cannot afford.
- Reject bets that would drive p outside (0.02, 0.98) unless resolving.
- Numerically stable: subtract max before exp.

## Double-entry cage (stolen from the engine invariant)

Every chip move posts two legs. Σ Dr = Σ Cr. Print variance on the cage
plaque. If variance ≠ 0, freeze the table.

Suggested accounts:

- 1000 House float (asset)
- 1100 Player chips outstanding (liability)
- 1200 Market YES inventory
- 1210 Market NO inventory
- 4000 Table vig / LMSR surplus
- 5000 Resolution payouts

Buy-in 1,000 chips: Dr 1000 / Cr 1100.
Buy YES: player chips down, YES inventory up, cash to market book — balanced.
Resolve YES: YES shares pay 1, NO shares pay 0, surplus to 4000.

## Tables

Markets are PreStocks names and the questions the trade floor already loads.
There is no event, no venue, and no ticketed night. The product is Senda.
Read AGENTS.md before changing the pit.

## UX (table-side, not a feed)

- Pit floor: four oval felt tables, click to sit.
- Seated: overhead felt, YES box left, NO box right, dealer disc in center
  showing p% as a split bar.
- Chip rail: denominations 1 / 5 / 25 / 100 / 500. Click to arm, click box
  to drop. Confirm toast with cost and new implied p.
- Positions: your YES/NO share counts + mark-to-market.
- Cage: buy-in / cash-out simulated chips, journal of last 8 balanced posts.
- Guest play allowed (session stack). Sign-in persists stack via auth + neon.
- Mobile 390px: one table at a time, chip rail as a bottom sheet, targets ≥ 44px.

## Visual

Ink pit `#0b0c10`, felt `#1a3a2a` (token, not random hex in JSX), ember
chips `#e23d3d`, bone typography. No purple, no gold fills, no neon
casino-cliché. Pair with `design-ui`. Photographic felt/texture via Imagine
if tools exist; else CSS grain + SVG felt.

## Explicitly forbidden

- Real-money gambling, deposits, withdrawals, crypto rails
- Playing cards, roulette wheel as the product, slots
- Copying `monetization_markets_engine.py` virtual cards / Catvertising
- Hypothetical "12k players" metrics
- Touching the parent event site (`src/components/{hero,agenda,speakers,tickets,venue,rsvp-form}*`, `src/lib/event.ts`)
- Binding **0.0.0.0:8080** — that port is how the app is served.
