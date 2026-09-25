"""The public PreStocks book. A print under the mark is cheap."""

import json
import urllib.request

BOOK = "https://prestocks.com/api/prestocks"


class Name:
    def __init__(self, symbol: str, mint: str, last: float, mark: float, name: str = ""):
        self.symbol = symbol
        self.mint = mint
        self.last = last
        self.mark = mark
        self.name = name or symbol

    def premium(self):
        return premium(self.last, self.mark)


def premium(last: float, mark: float):
    if last is None or mark is None or mark <= 0 or last <= 0:
        return None
    return (last - mark) / mark


def cheapest(names, n=5):
    rows = [name for name in names if name.premium() is not None]
    rows.sort(key=lambda name: name.premium())
    return rows[:n]


def from_payload(raw) -> list:
    if not isinstance(raw, list):
        return []
    out = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        mint = str(row.get("contract_address") or "")
        symbol = str(row.get("symbol") or "")
        if not mint or not symbol:
            continue
        mark = _num(row.get("markPrice"))
        last = _num(row.get("tokenPrice")) or mark
        if last <= 0 and mark <= 0:
            continue
        out.append(Name(symbol, mint, last, mark, str(row.get("name") or symbol)))
    return out


def load(url: str = BOOK, timeout: float = 8.0) -> list:
    req = urllib.request.Request(url, headers={"accept": "application/json", "user-agent": "Senda/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return from_payload(json.loads(res.read().decode()))


def _num(value) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    if number != number:
        return 0.0
    return number
