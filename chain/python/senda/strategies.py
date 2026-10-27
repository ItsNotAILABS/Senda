"""Prints an agent can sign. Discount buys, rich sells. Nothing is sent from here."""

DISCOUNT = -0.02
RICH = 0.02
DIP_LO = -0.08
DIP_HI = -0.02
DIP_MID = -0.04
TAKE = 0.04
STOP = -0.025
HOLD_MS = 36 * 60 * 60 * 1000
MIN_LIQ = 250_000
CASH = {"USDC", "USDT", "USD1", "PYUSD", "CASH", "USDS", "UXD"}


def sized(usd, cap):
    try:
        usd = float(usd)
        cap = float(cap)
    except (TypeError, ValueError):
        return 0.0
    if usd != usd or usd <= 0:
        return 0.0
    if cap != cap or cap <= 0:
        return usd
    return min(usd, cap)


def intents(names, usd, cap=0):
    size = sized(usd, cap)
    if size <= 0:
        return []
    priced = [name for name in names if name.premium() is not None and name.last > 0 and name.mint]
    cheap = [name for name in priced if name.premium() <= DISCOUNT]
    cheap.sort(key=lambda name: name.premium())
    rich = [name for name in priced if name.premium() >= RICH]
    rich.sort(key=lambda name: -name.premium())
    out = []
    for name in cheap[:4]:
        out.append({"symbol": name.symbol, "mint": name.mint, "side": "buy", "usd": size, "why": "discount"})
    for name in rich[:4]:
        out.append({"symbol": name.symbol, "mint": name.mint, "side": "sell", "usd": size, "why": "rich"})
    return out


def pick_dip(rows):
    """Liquid name closest to a 4% down day. Stables and thin books are skipped."""
    band = []
    for row in rows:
        try:
            change = float(row.get("change"))
            price = float(row.get("price") or 0)
            liq = float(row.get("liq") or 0)
        except (TypeError, ValueError):
            continue
        symbol = str(row.get("symbol") or "").upper()
        if price <= 0 or symbol in CASH or liq < MIN_LIQ:
            continue
        if DIP_LO <= change <= DIP_HI:
            band.append(row)
    if not band:
        return None
    band.sort(key=lambda row: abs(float(row["change"]) - DIP_MID))
    return band[0]


def exit_reason(entry, last, opened_at, now):
    try:
        entry = float(entry)
        last = float(last)
        opened_at = float(opened_at)
        now = float(now)
    except (TypeError, ValueError):
        return None
    if entry <= 0 or last <= 0 or opened_at <= 0:
        return None
    pnl = last / entry - 1
    if pnl >= TAKE:
        return "take"
    if pnl <= STOP:
        return "stop"
    if now - opened_at >= HOLD_MS:
        return "time"
    return None
