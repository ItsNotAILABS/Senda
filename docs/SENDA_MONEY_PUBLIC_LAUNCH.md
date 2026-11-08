# Senda Money — Public Launch Security & Peer Payments

## Product: everyday dollars, cryptographic rails when required

Senda's four primary product families remain **Trade**, **Pay & Send**, **Agents**, **Liquify**. Prediction markets are a multi-venue financial flow (Kalshi, Phantom US, DFlow, World and Polymarket), not an exclusive provider or a substitute for card/bank funding.

A user should experience: choose a friend -> enter USD -> see recipient and delivery method -> review true total fees -> authorize -> follow a verified receipt. Do not expose blockchain complexity unnecessarily, but do not conceal that a USDC wallet transfer is **not** a bank USD transfer or an insured deposit.

### Implemented now

- `/payments`: destination-first friend payments. Display USD; send the same value as native Solana USDC. Real Phantom signing and transfer tracking use the existing `payUsdc` path with its transaction recovery journal. Recipient must be a full Solana wallet address, confirmed out of band; unverified handles, phone numbers and emails cannot silently redirect funds.
- `/payments/request`: genuine Solana Pay URI payment request, not a credit to a local cash account. A request is not marked paid.
- `/payments/activity`: connected wallet readout and recovered transaction status; not simulated bank transaction history.
- `/payments/add`, `/payments/exchange` and `/payments/nearby`: wallet-based navigation and truthful non-connected states. The live wallet conversion screen is preserved; fabricated card top-ups are not presented as settled cash.
- `src/lib/friend-payments.mjs`: exact decimal cent parser, recipient verification, per-transaction spending limit and memo limits.
- `src/lib/money-settlement-core.mjs`: provider-backed funding/settlement/payout finite-state machine with idempotent event IDs, explicit transition checks and verified-provider receipt requirement. **This is a server-side orchestration contract, not a connected debit-card processor**.
- `src/lib/paper-money-policy.mjs` and `src/lib/wallet.ts`: legacy simulated card charges, cash creation, local send, bank withdraw, paper cover payments, and virtual card issuance are blocked in public builds. Paper data can only be used in explicit local development with `VITE_SENDA_ENABLE_PAPER_MONEY=true`.
- `src/lib/receive-account.ts`: Bridge customer provisioning now requires a real signed-in user, that user's explicit customer allowance, opt-in enablement and a fresh Phantom signMessage proving ownership of the exact wallet/currency before the server contacts Bridge. A single shared Bridge customer ID is never used for arbitrary visitors. Multi-user Bridge customer provisioning still requires a per-user customer mapping and authorization policy.

### Native debit card -> friend payment desired flow (not yet live)

1. Cardholder chooses **Debit card** and amount. Processor-hosted tokenization or checkout collects PAN/CVV; Senda frontend/backend must not accept or store raw PAN, CVV or full magnetic stripe data.
2. Processor creates an authenticated authorization subject to identity, fraud, region, limits, 3DS/SCA, chargebacks and card-network rules.
3. Funding enters `funding-pending`, then `authorized` (not spendable).
4. Only a **verified processor settlement receipt** can advance the funds to `settled`.
5. A qualified treasury/stablecoin issuer or processor converts the cleared amount into actual USDC, with a locked quote, per-provider fees, slippage and sanctions/KYC checks. `converted` requires its real receipt.
6. If receiver has a verified Senda wallet, the wallet signs the USDC transfer. If receiver needs bank USD, a licensed payout provider transfers USD and returns an independently verified bank receipt. No intermediary balance may be marketed as FDIC-insured without issuer/ownership proof.
7. A transfer is `delivered` **only** once the exact destination, amount and settlement confirmation reconcile. Duplicates, reversals, partial settlements, chargebacks and unsupported jurisdictions require explicit recovery and reserves.

**No source code in this feature can charge a debit card or cash out to a bank account without these provider integrations.**

### Threat model / release gates

- **Money laundering, fraud, consumer regulations**: qualified banking/card/payment partner, KYC/AML, sanctions, transfer limits, geography, payout eligibility, refund and disputed payment handling.
- **Authorization & tenancy**: verified per-user sessions, signed wallet ownership, recipient directory binding, deny cross-tenant customer/account access. Do not expose Bridge virtual-account instructions from an arbitrary caller-supplied wallet or globally shared customer ID.
- **Wallet attacks**: verify Solana USDC mint and token program, owner address, destination, amount, chain, transaction simulation, signer, fresh quote, transaction recovery, and double-signing protection.
- **Card data**: never ask for or log raw card numbers/CVV in Senda; use a PCI-certified hosted payment provider; Senda must not present locally generated PANs as issuer-backed cards.
- **Receipts**: network submission != settlement; verify finality and chain token balance effects; provider webhook signature verification and database idempotency before marking a payment complete. Use a transactional double-entry ledger and reserves for fiat; an in-browser paper balance is not funds.
- **Predictions**: Phantom US Kalshi account, DFlow Solana outcome tokens and World are separate legal/execution models. The existing DFlow Phantom-signed lane remains partner/KYC-gated. Do not route phantom Cash as generic USDC or import user Kalshi positions without authorized APIs.
- **Data retention**: encrypt personal payment/recipient data, restrict readback by user, redact credentials, run dependency+secrets scans, penetration testing and error budget / outage drills.
- **Go/no-go**: merchant funds movement and bank/card rails are OFF until issuer/processor confirmation and real end-to-end signed transaction and settlement proof.

### Verification

```sh
node --test scripts/friend-payments.test.mjs scripts/money-settlement-core.test.mjs scripts/paper-money-policy.test.mjs
npm ci
npm run typecheck
npm run build:dev
```

This is review-branch source until merged/deployed. No actual card authorization, bank payout, prediction bet or money movement was initiated while building it.
