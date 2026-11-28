-- House corridor orders. The row is the book. A bank receipt is not implied.

create table if not exists house_order (
  id text primary key,
  rules text not null,
  direction text not null,
  corridor text not null,
  country text not null,
  rail text not null,
  desk text not null,
  ccy text not null,
  usd numeric(14, 2) not null,
  rate numeric(18, 6) not null,
  fee_usd numeric(14, 2) not null,
  net_usd numeric(14, 2) not null,
  local_amount numeric(18, 2) not null,
  account_json text not null,
  status text not null,
  signature text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists house_order_desk_idx on house_order (desk, created_at desc);
