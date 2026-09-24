-- Street refs so a sat book can still pull CLOB history / Kalshi series.
alter table market_meta add column if not exists token_yes text not null default '';
alter table market_meta add column if not exists condition_id text not null default '';
alter table market_meta add column if not exists series_ticker text not null default '';
alter table market_meta add column if not exists description text not null default '';
alter table market_meta add column if not exists rules text not null default '';
