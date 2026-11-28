-- A model can reserve a budget and queue a trade. It cannot sign.

create table if not exists agent_harness (
  id text primary key,
  token_hash text not null unique,
  owner text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists agent_strategy (
  id text primary key,
  harness_id text not null references agent_harness (id),
  name text not null,
  category text not null default 'custom',
  thesis text not null default '',
  rule_json text not null,
  executable boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agent_strategy_harness_idx on agent_strategy (harness_id);

create table if not exists agent_mission (
  id text primary key,
  harness_id text not null references agent_harness (id),
  strategy_id text not null,
  bankroll_usd numeric(12, 2) not null,
  aim_usd numeric(12, 2) not null,
  spent_usd numeric(12, 2) not null default 0,
  day text not null default '',
  day_spent numeric(12, 2) not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists agent_mission_harness_idx on agent_mission (harness_id);

create table if not exists agent_intent (
  id text primary key,
  harness_id text not null references agent_harness (id),
  mission_id text not null,
  symbol text not null,
  mint text not null,
  side text not null,
  usd numeric(12, 2) not null,
  why text not null default '',
  status text not null default 'queued',
  signature text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists agent_intent_harness_idx on agent_intent (harness_id, status);

create table if not exists agent_tracker (
  id text primary key,
  harness_id text not null references agent_harness (id),
  symbol text not null,
  mint text not null default '',
  thesis text not null default '',
  created_at timestamptz not null default now(),
  unique (harness_id, symbol)
);
