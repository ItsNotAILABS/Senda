---
name: launch-summit
description: >
  Build a one-page launch / summit event site: sticky section nav, live
  countdown, agenda, speaker cards, ticket tiers with live capacity, venue
  wayfinding, RSVP with success/waitlist feedback. Reuse across projects by
  swapping the EVENT contract — do not restub the chrome. Default Dallas
  venue is Vice Park (2601 Gaston Ave). Never default to The Foundry or
  Deep Ellum. Triggers on "launch party", "summit", "event site", "countdown
  RSVP", "speakers agenda tickets venue", "launch night".
metadata:
  short-description: "One-page launch event: countdown, agenda, speakers, tickets, venue, RSVP"
user-invocable: true
---

# Launch Summit

Ship a **playable one-page launch event**, not a wireframe. One URL, six
sections, one RSVP. Pair with **`design-ui`** (tokens, anti-slop) and
**`neon`** (RSVP persistence). Auth is optional prefill only — guests can
RSVP unsigned.

This skill is **reusable**. Future launch parties for other products should
swap the EVENT contract and regenerate art — do not rebuild the chrome.

**Read `references/` for depth** (loaded on demand):
- `references/event-contract.md` — the `EVENT` / `TIERS` / `AGENDA` / `SPEAKERS` shape
- `references/dallas-venues.md` — Vice Park defaults; banned venues

---

## 1. When this skill fires

Use it for: product launches, lab nights, paper drops, Shipaton-style
summits, any "doors + countdown + guest list" page.

Do **not** use it for dashboards, games, prediction pits, or multi-page
conference CMS. Sibling products (e.g. a table-game pit) stay in their own
worktree; this site keeps the live preview.

---

## 2. Required sections (sticky nav)

| id | Section | Must include |
| --- | --- | --- |
| `event` | Hero | Date, time, city, venue pin, tagline, **live countdown** (client-mounted, no SSR clock hydration mismatch), primary CTA → `#rsvp` |
| `agenda` | Schedule | Timed list, optional tracks (Main / A / B / All) |
| `speakers` | Cards | Photo or geometric mark, role, short bio. No fake likeness of a named real person |
| `tickets` | Tiers | ≥2 tiers, **capacity bar**, remaining count, sold-out → waitlist CTA |
| `venue` | Place | Real photo + schematic wayfinding (streets + pin), transit, parking |
| `rsvp` | Form | Name, email, optional affiliation/notes, tier radio, success panel |

Sticky nav highlights the in-view section via IntersectionObserver.
Mobile: hamburger, tap targets ≥ 44px, no horizontal overflow.

---

## 3. Data contract — one file

All copy lives in `src/lib/event.ts` (`EVENT`, `TIERS`, `AGENDA`, `SPEAKERS`,
`NAV`). Components read that file. **Never scatter venue strings.**

When the user names a new project, change `EVENT` and regenerate venue/hero
art. Keep the chrome.

Default Dallas venue (unless the user names another they can actually book):

```
Vice Park
2601 Gaston Ave, Dallas, TX 75226
DART Green Line · Baylor University Medical Center Station
Valet on Gaston
Rooms: The House (keynotes) · Sky Club (dinner) · Beach Club (afterhours)
```

**Banned defaults:** The Foundry, Deep Ellum, Exposition Lot, 2803 Main.
Those were a one-off that the owner cannot book.

---

## 4. RSVP / capacity (real, not fake)

- Table `rsvps` via `migrations/0002_*.sql` (`email` unique, `tier`, `status` confirmed|waitlist)
- Public `submitRsvp` / `getCapacity` server fns — **no auth required**
- Capacity = `seedClaimed + dbCount`; at zero remaining, new RSVPs go waitlist
- Duplicate email returns the existing row as success ("already on the list")
- After submit: inline success panel (name, tier, status) + toast
- Signed-in visitors: prefill name/email from `useCurrentUser()`

See `src/lib/rsvp.ts` in this workspace for the working handler.

---

## 5. Visual system

- One accent (this instance: ember `#e23d3d` on ink `#0b0c10`) — not purple, not gold fills
- Display + body pairing (this instance: Syne + Figtree)
- Tokens in `src/styles.css` `@theme`; no ad-hoc hex in JSX
- Countdown: `tabular-nums`, `font-mono`, mount-then-tick (SSR renders empty digits)
- Hero/venue: generated photographic art, not gray boxes
- Wayfinding: labeled street schematic, not a fake Google Map

---

## 6. Auth

Wire Better Auth (`auth` skill) so Sign in / UserButton work. RSVP stays
public. Login callback returns to `/`.

---

## 7. How to reuse for a new launch party

Do this in order. Do **not** restub routes, RSVP, countdown, or nav.

1. Rename `EVENT.name`, `year`, `tagline`, `blurb`, `repo`.
2. Set `dateLabel`, `timeLabel`, `startsAt` (UTC). Dallas CDT = UTC−5.
3. Keep **Vice Park** unless the user names a venue they can actually book.
4. Grep the old product name, old venue, old city, old street. Zero leftovers.
5. Rewrite `TIERS` / `AGENDA` / `SPEAKERS` for the new product. Speakers who
   are real named people get `image: null` (initials mark) — no fake likeness.
6. Regenerate `public/images/hero.jpg` and `venue.jpg` to match the place.
7. Refresh `public/og.jpg` + `src/lib/og/site.json` title.
8. Reset ticket `seedClaimed` to honest numbers. Re-test RSVP paths.

Vice Park rooms to name in copy: **The House** (keynotes), **Sky Club**
(dinner / Core Circle), **Beach Club** (pool terrace / afterhours).

---

## 8. Reuse checklist

- [ ] `EVENT.venue` is a place the owner can actually get into
- [ ] No leftover previous-venue strings (grep city, street, nickname)
- [ ] Hero + venue images match the new place
- [ ] Countdown target is in the future
- [ ] Ticket seed/capacity messaging is honest
- [ ] RSVP success path tested (new, duplicate, waitlist)
- [ ] Sticky nav + mobile ~390px, no overflow
- [ ] `design-ui` + `og` skills applied (custom `og.jpg`, `site.json` `"card": "custom"`)
- [ ] Sibling products did **not** steal the live preview from this site
