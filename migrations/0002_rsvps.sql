create table if not exists rsvps (
  id          serial primary key,
  name        text not null,
  email       text not null unique,
  affiliation text,
  notes       text,
  tier        text not null check (tier in ('signal', 'kernel', 'core')),
  status      text not null default 'confirmed' check (status in ('confirmed', 'waitlist')),
  created_at  timestamptz not null default now()
);

create index if not exists rsvps_tier_idx on rsvps (tier);
