-- Single-use nonces for Phantom wallet-ownership proofs on Bridge receive accounts.
-- A nonce row lives until its signature window closes; replays hit the primary key.

create table if not exists receive_auth_nonce (
  nonce      text primary key,
  expires_at timestamptz not null
);

create index if not exists receive_auth_nonce_expires_idx on receive_auth_nonce (expires_at);
