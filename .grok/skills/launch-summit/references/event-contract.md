# Event contract

Single source: `src/lib/event.ts`.

```ts
EVENT = {
  name, year, tagline, blurb,
  dateLabel, timeLabel, startsAt, // ISO UTC for the countdown
  city, venue, address, transit, parking,
  repo, repoLabel,
}

TIERS: { id, name, price, capacity, seedClaimed, perks[], blurb }[]
AGENDA: { time, title, detail, track }[]   // track: "All" | "Main" | "A" | "B"
SPEAKERS: { id, name, role, core, bio, image: string | null, initials }[]
NAV: { id, label }[]  // ids must match section `id`s
```

`startsAt` is the instant the countdown hits zero. Convert local civil time
to UTC (Dallas CDT = UTC−5). Render `dateLabel` / `timeLabel` for humans;
never format `Date` in the user's locale on the server.

Capacity remaining on a tier:

```
remaining = max(0, capacity - seedClaimed - count(rsvps where tier = id))
waitlist  = remaining === 0
```

Speaker `image: null` → geometric mark + initials. Do not generate a
photoreal likeness of a named real person.
