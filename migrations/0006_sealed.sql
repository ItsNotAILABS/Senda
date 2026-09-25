-- Ciphertext only. The wallet signs the grant. The key never lands here.
create table if not exists sealed_grant (
  wallet text primary key,
  nonce text not null,
  expires_at timestamptz not null
);

create table if not exists sealed_blob (
  wallet text not null,
  slot text not null,
  box text not null,
  primary key (wallet, slot)
);
