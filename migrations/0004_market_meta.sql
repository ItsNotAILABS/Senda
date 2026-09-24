-- Sat books from venue plugins (Polymarket / Kalshi / Manifold).
-- Display fields live here; LMSR inventory stays in market_state.

create table if not exists market_meta (
  market_id  text primary key,
  venue      text not null,
  venue_key  text not null,
  name       text not null,
  question   text not null,
  resolve_by text not null,
  street_yes numeric not null,
  volume     numeric not null default 0,
  url        text not null,
  blurb      text not null,
  updated_at timestamptz not null default now()
);

create index if not exists market_meta_venue_idx on market_meta (venue);
