-- The PIT — prediction-market cage + LMSR books.
-- Per-user rows use TEXT user_id (Better Auth ids / 'dev-user' / 'guest' / 'house').

create table if not exists chip_stacks (
  user_id    text primary key,
  chips      int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id         serial primary key,
  user_id    text not null,
  account    text not null,
  dr         numeric not null default 0,
  cr         numeric not null default 0,
  ref        text not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_entries_user_id_idx on ledger_entries (user_id);
create index if not exists ledger_entries_created_at_idx on ledger_entries (created_at desc);
create index if not exists ledger_entries_ref_idx on ledger_entries (ref);

create table if not exists positions (
  user_id    text not null,
  market_id  text not null,
  yes_shares numeric not null default 0,
  no_shares  numeric not null default 0,
  primary key (user_id, market_id)
);

create table if not exists market_state (
  market_id  text primary key,
  q_yes      numeric not null default 0,
  q_no       numeric not null default 0,
  b          numeric not null,
  status     text not null default 'open',
  updated_at timestamptz not null default now()
);
