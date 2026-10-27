-- The login remembers a public Solana address. Never a key.
create table if not exists account_address (
  user_id text primary key,
  address text not null,
  updated_at timestamptz not null default now()
);
