"""Affine corridor router.

A rail pays the recipient

    local(q) = (q - fixed) * mid * (1 - spread)

inside its band, else nothing. mid is a live print. fixed and spread are
part of that rail's schedule. This does not move money and it does not
turn a mid into a bank deposit.

Corner. If no cap binds, one rail is enough. A split pays a second fixed
fee. Moving the slice onto the cheaper marginal spread never pays less,
and it drops that extra fixed fee.

When a cap binds, fill the cheapest spread first (water-fill). Open the
next rail only for the remainder.

Breakpoint. Two open rays meet at

    q* = (a1*f1 - a2*f2) / (a1 - a2)

where a = mid * (1 - spread). Parallel rays (same spread) do not meet.
The next breakpoint is the smallest q* above the amount that still sits
inside both bands.

Prints. The planning mid is the median of prints inside a band of
max(3*MAD, 50 bps). A print outside that band is dropped, not averaged in.
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_HALF_EVEN, InvalidOperation
from typing import Any

MONEY = Decimal("0.01")
RATE = Decimal("0.000001")
BPS = Decimal("0.01")
BAND = Decimal("0.005")
MAX_USD = Decimal("5000")


def D(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("bad decimal") from exc


def money(n: Decimal) -> str:
    return format(n.quantize(MONEY, rounding=ROUND_HALF_EVEN), "f")


def rate(n: Decimal) -> str:
    q = n.quantize(RATE, rounding=ROUND_HALF_EVEN)
    text = format(q, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def bps(n: Decimal) -> str:
    return format(n.quantize(BPS, rounding=ROUND_HALF_EVEN), "f")


def median(xs: list[Decimal]) -> Decimal:
    s = sorted(xs)
    n = len(s)
    if n == 0:
        raise ValueError("empty")
    mid = n // 2
    if n % 2:
        return s[mid]
    return (s[mid - 1] + s[mid]) / 2


def local_of(usd: Decimal, fixed: Decimal, spread: Decimal, mid: Decimal) -> Decimal | None:
    if usd <= 0 or mid <= 0 or spread >= 1 or spread < 0 or fixed < 0:
        return None
    net = usd - fixed
    if net <= 0:
        return None
    return (net * mid * (Decimal(1) - spread)).quantize(MONEY, rounding=ROUND_HALF_EVEN)


class Rail:
    def __init__(self, raw: dict[str, Any]) -> None:
        self.id = str(raw.get("id") or "")
        self.label = str(raw.get("label") or self.id)
        self.note = str(raw.get("note") or "")
        self.kind = str(raw.get("kind") or "live")
        self.fixed = D(raw.get("fixed") or "0")
        self.spread_bps = int(raw.get("spreadBps") or 0)
        if self.spread_bps < 0 or self.spread_bps > 10_000:
            raise ValueError("spread")
        self.spread = Decimal(self.spread_bps) / Decimal(10_000)
        self.lo = D(raw.get("lo") or "0")
        hi = raw.get("hi")
        self.hi = None if hi in (None, "") else D(hi)
        if not self.id or len(self.id) > 40:
            raise ValueError("rail")
        if self.fixed < 0 or self.lo < 0:
            raise ValueError("rail bounds")
        if self.hi is not None and self.hi < self.lo:
            raise ValueError("rail band")

    def fits(self, usd: Decimal) -> bool:
        if usd < self.lo:
            return False
        if self.hi is not None and usd > self.hi:
            return False
        return True


class Print:
    def __init__(self, raw: dict[str, Any]) -> None:
        self.id = str(raw.get("id") or "")
        self.label = str(raw.get("label") or self.id)
        self.as_of = str(raw.get("asOf") or "")
        self.rate = D(raw.get("rate"))
        if not self.id or self.rate <= 0:
            raise ValueError("print")


def robust(prints: list[Print]) -> tuple[Decimal, list[Print], list[str]]:
    if not prints:
        raise ValueError("no live print")
    med = median([p.rate for p in prints])
    deviations = [abs(p.rate - med) for p in prints]
    mad = median(deviations)
    band = max(mad * 3, med * BAND)
    kept = [p for p in prints if abs(p.rate - med) <= band]
    if not kept:
        kept = list(prints)
    planning = median([p.rate for p in kept])
    dropped = [p.id for p in prints if p.id not in {k.id for k in kept}]
    return planning, kept, dropped


def cross(a: Rail, b: Rail, mid: Decimal) -> Decimal | None:
    a1 = mid * (Decimal(1) - a.spread)
    a2 = mid * (Decimal(1) - b.spread)
    if a1 == a2:
        return None
    q = (a1 * a.fixed - a2 * b.fixed) / (a1 - a2)
    if q <= 0:
        return None
    for rail in (a, b):
        if q < rail.lo:
            return None
        if rail.hi is not None and q > rail.hi:
            return None
    return q.quantize(MONEY, rounding=ROUND_HALF_EVEN)


def next_break(rails: list[Rail], usd: Decimal, mid: Decimal) -> str | None:
    hits: list[Decimal] = []
    for i, left in enumerate(rails):
        for right in rails[i + 1 :]:
            q = cross(left, right, mid)
            if q is not None and q > usd + Decimal("0.005"):
                hits.append(q)
    if not hits:
        return None
    return money(min(hits))


def waterfill(rails: list[Rail], usd: Decimal, mid: Decimal) -> tuple[list[dict[str, Any]], Decimal]:
    """Cheapest spread first, but only if its fixed fee still beats the next rail on that slice."""
    ordered = sorted(rails, key=lambda r: (r.spread_bps, r.fixed, 0 if r.id == "solana" else 1, r.id))
    left = usd
    slices: list[dict[str, Any]] = []
    for i, rail in enumerate(ordered):
        if left <= 0:
            break
        room = left if rail.hi is None else min(left, rail.hi)
        mine = None if room <= 0 else local_of(room, rail.fixed, rail.spread, mid)
        if mine is None or room < rail.lo:
            continue
        alternative: Decimal | None = None
        for other in ordered[i + 1 :]:
            alt_room = room if other.hi is None else min(room, other.hi)
            if alt_room + Decimal("0.0000001") < room:
                continue
            got = local_of(room, other.fixed, other.spread, mid)
            if got is not None and (alternative is None or got > alternative):
                alternative = got
        if alternative is not None and alternative > mine:
            continue
        slices.append(
            {
                "id": rail.id,
                "label": rail.label,
                "usd": money(room),
                "local": money(mine),
                "spreadBps": rail.spread_bps,
                "kind": rail.kind,
                "note": rail.note,
            }
        )
        left -= room
    return slices, left


def rank_full(rails: list[Rail], usd: Decimal, mid: Decimal) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for rail in rails:
        use = usd
        capped = False
        if rail.hi is not None and usd > rail.hi:
            use = rail.hi
            capped = True
        if not rail.fits(use):
            rows.append(
                {
                    "id": rail.id,
                    "label": rail.label,
                    "local": None,
                    "usd": money(usd),
                    "spreadBps": rail.spread_bps,
                    "kind": rail.kind,
                    "note": rail.note,
                    "capped": capped,
                }
            )
            continue
        got = local_of(use, rail.fixed, rail.spread, mid)
        rows.append(
            {
                "id": rail.id,
                "label": rail.label,
                "local": None if got is None else money(got),
                "usd": money(use),
                "spreadBps": rail.spread_bps,
                "kind": rail.kind,
                "note": rail.note,
                "capped": capped,
            }
        )

    def key(row: dict[str, Any]) -> tuple[int, Decimal, int]:
        if row["local"] is None:
            return (1, Decimal(0), row["spreadBps"])
        return (0, -D(row["local"]), row["spreadBps"])

    rows.sort(key=key)
    return rows


def print_shear(kept: list[Print], planning: Decimal) -> str | None:
    if len(kept) < 2 or planning <= 0:
        return None
    rates = sorted((p.rate for p in kept), reverse=True)
    return bps((rates[0] - rates[1]) / planning * Decimal(10_000))


def route(doc: dict[str, Any]) -> dict[str, Any]:
    usd = D(doc.get("usd"))
    if usd <= 0 or usd > MAX_USD:
        raise ValueError("amount must be between 0 and 5000")
    currency = str(doc.get("currency") or "")
    if not currency or len(currency) > 8:
        raise ValueError("currency")
    prints = [Print(p) for p in doc.get("prints") or []]
    planning, kept, dropped = robust(prints)
    rails = [Rail(r) for r in doc.get("rails") or []]
    card_raw = doc.get("card") or {}
    card = Rail(
        {
            "id": "card",
            "label": "Card scenario",
            "fixed": card_raw.get("fixed") or "0",
            "spreadBps": int(card_raw.get("spreadBps") or 0),
            "lo": "1",
            "hi": card_raw.get("cap"),
            "kind": "scenario",
            "note": "Assumed issuer spread. Not a quote from an issuer.",
        }
    )
    accept = str(doc.get("accept") or "usdc")
    if accept not in ("usdc", "card", "either"):
        raise ValueError("accept")
    live = [r for r in rails if r.kind == "live"]
    if accept == "card":
        pool = [card]
    elif accept == "either":
        pool = live + [card]
    else:
        pool = live
    if not pool:
        raise ValueError("no rail")
    slices, uncovered = waterfill(pool, usd, planning)
    received = sum((D(row["local"]) for row in slices), Decimal(0))
    ranked = rank_full(pool, usd, planning)
    usable = [row for row in ranked if row["local"] is not None]
    shear = None
    if len(usable) >= 2:
        gap = D(usable[0]["local"]) - D(usable[1]["local"])
        base = usd * planning
        if base > 0:
            shear = bps(gap / base * Decimal(10_000))
    caps_bind = any(r.hi is not None for r in pool)
    split = "capped" if caps_bind and (uncovered > 0 or len(slices) > 1) else "single"
    proof = (
        "One rail. A split would pay a second fixed fee and cannot beat the cheaper spread."
        if split == "single"
        else "A cap bound, so the remainder steps to the next spread. Nothing past the cap is priced as filled."
    )
    ladder = []
    usdc_local = local_of(usd, Decimal(0), Decimal(0), planning)
    for step in (50, 100, 200):
        spread = Decimal(step) / Decimal(10_000)
        got = local_of(usd, Decimal(0), spread, planning)
        gap = None if got is None or usdc_local is None else money(usdc_local - got)
        ladder.append({"spreadBps": step, "local": None if got is None else money(got), "gap": gap})
    kept_rows = [
        {"id": p.id, "label": p.label, "rate": rate(p.rate), "asOf": p.as_of, "kept": True}
        for p in prints
        if p.id not in dropped
    ]
    dropped_rows = [
        {"id": p.id, "label": p.label, "rate": rate(p.rate), "asOf": p.as_of, "kept": False}
        for p in prints
        if p.id in dropped
    ]
    return {
        "currency": currency,
        "usd": money(usd),
        "planningRate": rate(planning),
        "prints": kept_rows + dropped_rows,
        "printShearBps": print_shear(kept, planning),
        "winner": slices[0] if slices else None,
        "received": money(received),
        "slices": slices,
        "uncovered": money(uncovered),
        "ranked": ranked,
        "railShearBps": shear,
        "breakpointUsd": next_break(pool, usd, planning),
        "split": split,
        "proof": proof,
        "ladder": ladder,
        "accept": accept,
    }


def main() -> None:
    raw = sys.stdin.read()
    try:
        out = route(json.loads(raw))
    except (ValueError, json.JSONDecodeError, KeyError, InvalidOperation) as exc:
        json.dump({"ok": False, "error": str(exc) or "The corridor did not price."}, sys.stdout)
        return
    json.dump({"ok": True, **out}, sys.stdout)


if __name__ == "__main__":
    main()
