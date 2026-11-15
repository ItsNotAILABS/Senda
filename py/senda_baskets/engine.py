"""Price a basket and build the devnet Open instruction.

A share is the dollars you name, split by weight. Carry is only a rate a
source published. A sleeve with no rate is a mark. Weights are basis points
and must sum to 10_000. The instruction is the bytes the Baskets program reads.
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_HALF_EVEN

MONEY = Decimal("0.01")
QTY = Decimal("0.00000001")
BPS = Decimal("0.01")
CENT = Decimal("1")
ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def D(value) -> Decimal:
    return Decimal(str(value))


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_EVEN)


def b58decode(text: str) -> bytes:
    num = 0
    for ch in text:
        idx = ALPH.find(ch)
        if idx < 0:
            raise ValueError("mint")
        num = num * 58 + idx
    pad = 0
    for ch in text:
        if ch != "1":
            break
        pad += 1
    raw = num.to_bytes((num.bit_length() + 7) // 8, "big") if num else b""
    out = b"\x00" * pad + raw
    if len(out) != 32:
        raise ValueError("mint")
    return out


def pad_name(name: str) -> bytes:
    raw = name.strip().encode()
    if len(raw) < 2 or len(raw) > 16:
        raise ValueError("name")
    if any(b != 32 and not (48 <= b <= 57 or 65 <= b <= 90 or 97 <= b <= 122) for b in raw):
        raise ValueError("name")
    return raw.ljust(16, b"\x00")


def encode(name: str, legs: list[dict]) -> bytes:
    if not 2 <= len(legs) <= 8:
        raise ValueError("legs")
    total = 0
    seen = set()
    body = bytearray()
    for leg in legs:
        mint = str(leg["mint"])
        if mint in seen:
            raise ValueError("mint")
        seen.add(mint)
        bps = int(leg["bps"])
        if bps <= 0 or bps > 10_000:
            raise ValueError("weight")
        total += bps
        body += b58decode(mint)
        body += int(bps).to_bytes(2, "little")
    if total != 10_000:
        raise ValueError("weight")
    return bytes([0]) + pad_name(name) + bytes([len(legs)]) + bytes(body)


def price(doc: dict) -> dict:
    usd = money(D(doc["usd"]))
    if usd <= 0 or usd > Decimal("5000"):
        raise ValueError("amount")
    name = str(doc["name"])
    legs = doc["legs"]
    if not isinstance(legs, list):
        raise ValueError("legs")
    raw = encode(name, legs)
    cents = int((usd * 100).quantize(CENT, rounding=ROUND_HALF_EVEN))
    taken = 0
    rows = []
    income_cents = 0
    for i, leg in enumerate(legs):
        bps = int(leg["bps"])
        last = i == len(legs) - 1
        if last:
            leg_cents = cents - taken
        else:
            leg_cents = int((Decimal(cents) * Decimal(bps) / Decimal(10_000)).quantize(CENT, rounding=ROUND_HALF_EVEN))
            taken += leg_cents
        if leg_cents < 0:
            raise ValueError("weight")
        px = D(leg["price"])
        if px <= 0:
            raise ValueError("no live print")
        apy_raw = leg.get("apy")
        apy = None
        if apy_raw not in (None, "", "0", 0):
            apy = D(apy_raw)
            if apy <= 0 or apy > Decimal("0.5"):
                raise ValueError("rate")
        carry = 0
        if apy is not None:
            carry = int((Decimal(leg_cents) * apy).quantize(CENT, rounding=ROUND_HALF_EVEN))
            income_cents += carry
        qty = (Decimal(leg_cents) / Decimal(100) / px).quantize(QTY, rounding=ROUND_HALF_EVEN)
        rows.append(
            {
                "symbol": str(leg["symbol"]),
                "mint": str(leg["mint"]),
                "group": str(leg["group"]),
                "bps": bps,
                "price": format(px.quantize(Decimal("0.000001"), rounding=ROUND_HALF_EVEN), "f"),
                "usd": format(money(Decimal(leg_cents) / Decimal(100)), "f"),
                "qty": format(qty, "f"),
                "apy": None if apy is None else format(apy, "f"),
                "income": format(money(Decimal(carry) / Decimal(100)), "f"),
                "kind": "carry" if apy is not None else "mark",
            }
        )
    carry_bps = (Decimal(income_cents) * Decimal(10_000) / Decimal(cents)).quantize(BPS, rounding=ROUND_HALF_EVEN)
    return {
        "ok": True,
        "name": name.strip(),
        "usd": format(usd, "f"),
        "income": format(money(Decimal(income_cents) / Decimal(100)), "f"),
        "carryBps": format(carry_bps, "f"),
        "legs": rows,
        "instruction": raw.hex(),
        "accountBytes": 291,
        "proof": "Weights sum to 10,000. Carry is a published rate times that sleeve. A mark pays nothing.",
    }


def main() -> None:
    try:
        doc = json.load(sys.stdin)
        sys.stdout.write(json.dumps(price(doc)))
    except Exception as exc:  # noqa: BLE001 — the desk shows this string
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))


if __name__ == "__main__":
    main()
