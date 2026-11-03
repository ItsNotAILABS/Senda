-- Dollars that actually moved because someone signed in this app.
-- One signature is one row. A repeat does not add the dollars again.

create table if not exists move (
  signature text primary key,
  kind      text not null,
  title     text not null default '',
  usd       numeric not null,
  at        timestamptz not null default now()
);

create index if not exists move_kind_idx on move (kind);
