-- Single-use proofs and independent, hashed bearer sessions. Legacy grants are retired.
create table wallet_challenge (
  wallet text not null, purpose text not null, nonce text not null,
  expires_at timestamptz not null, primary key (wallet, purpose)
);
create table wallet_session (
  token_hash text primary key, wallet text not null, expires_at timestamptz not null
);
create index wallet_session_expiry on wallet_session(expires_at);
delete from sealed_grant;
create table sealed_vault (
  wallet text primary key, box text not null, revision integer not null default 1
);
-- Provisioned only by trusted onboarding after provider verification. No public writer.
create table bridge_wallet_customer (
  wallet text primary key, customer_id text not null unique,
  verified_at timestamptz not null, revoked_at timestamptz
);
