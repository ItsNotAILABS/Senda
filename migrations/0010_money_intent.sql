-- Durable store for money settlement intents (src/lib/money-settlement-core.mjs).
-- `body` is the full intent; `version` is the optimistic-concurrency counter that
-- compareAndSet checks, so concurrent provider webhooks cannot lose an update.

create table if not exists money_intent (
  id         text primary key,
  version    integer not null,
  body       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
