"""Cover terms. They ride in the memo of the premium. They are not a policy."""

from senda.pay import usd_to_atoms


class CoverTerms:
    def __init__(self, kind: str, symbol: str, strike_usd: float, cover_usd: float, premium_usd: float, until: int):
        if kind not in ("drop", "life"):
            raise ValueError("kind")
        symbol = symbol.strip().upper()
        if not symbol or len(symbol) > 12 or not symbol.isalnum():
            raise ValueError("symbol")
        self.kind = kind
        self.symbol = symbol
        self.strike_atoms = usd_to_atoms(strike_usd)
        self.cover_atoms = usd_to_atoms(cover_usd)
        self.premium_atoms = usd_to_atoms(premium_usd)
        self.until = int(until)

    def memo(self) -> str:
        return (
            f"Senda cover {self.kind} {self.symbol} "
            f"strike={self.strike_atoms} cover={self.cover_atoms} "
            f"premium={self.premium_atoms} until={self.until}"
        )
