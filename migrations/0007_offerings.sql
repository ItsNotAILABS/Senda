-- Every product Senda offers is a row here. Prices are not stored.
-- A row is the registration: what it is, where it lives, and what can sign it.

create table if not exists offering (
  id         text primary key,
  family     text not null,
  symbol     text not null,
  name       text not null,
  chain      text not null default '',
  mint       text not null default '',
  venue      text not null default '',
  sign_path  text not null default '',
  status     text not null default 'open',
  note       text not null default '',
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offering_family_idx on offering (family);
create index if not exists offering_status_idx on offering (status);
