-- Public chain evidence only; no signed-in user, local draft, private memo, or bank balance.
-- Optional feature gate: SENDA_ACTIVITY_INDEX_ENABLED=true AND DATABASE_URL set.
CREATE TABLE IF NOT EXISTS wallet_chain_receipt (
  network TEXT NOT NULL CHECK (network IN ('mainnet-beta','devnet')),
  owner TEXT NOT NULL CHECK (char_length(owner) BETWEEN 32 AND 44),
  signature TEXT NOT NULL CHECK (char_length(signature) BETWEEN 80 AND 90),
  status TEXT NOT NULL CHECK (status IN ('confirmed','finalized','failed')),
  slot BIGINT NOT NULL CHECK (slot > 0),
  block_time BIGINT NULL,
  delta_usdc_raw TEXT NULL CHECK (delta_usdc_raw ~ '^-?[0-9]+$'),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(network, owner, signature)
);
CREATE INDEX IF NOT EXISTS wallet_chain_receipt_history_idx
  ON wallet_chain_receipt(network, owner, slot DESC, signature);
