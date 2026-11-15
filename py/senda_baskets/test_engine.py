import unittest

from senda_baskets.engine import encode, price


STAKE = [
    {"symbol": "JitoSOL", "mint": "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", "group": "stake", "bps": 2000, "price": "180", "apy": None},
    {"symbol": "mSOL", "mint": "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", "group": "stake", "bps": 2000, "price": "200", "apy": "0.05"},
    {"symbol": "bSOL", "mint": "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", "group": "stake", "bps": 2000, "price": "190", "apy": None},
    {"symbol": "JupSOL", "mint": "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", "group": "stake", "bps": 2000, "price": "185", "apy": None},
    {"symbol": "INF", "mint": "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", "group": "stake", "bps": 2000, "price": "210", "apy": None},
]


class Baskets(unittest.TestCase):
    def test_equal_sleeves_and_one_published_rate(self):
        out = price({"name": "Stake book", "usd": "100", "legs": STAKE})
        self.assertTrue(out["ok"])
        self.assertEqual(out["usd"], "100.00")
        self.assertEqual([row["usd"] for row in out["legs"]], ["20.00", "20.00", "20.00", "20.00", "20.00"])
        self.assertEqual(out["income"], "1.00")
        self.assertEqual(out["carryBps"], "100.00")
        self.assertEqual(out["legs"][1]["kind"], "carry")
        self.assertEqual(out["legs"][0]["kind"], "mark")
        self.assertEqual(out["legs"][1]["qty"], "0.10000000")
        self.assertEqual(out["accountBytes"], 291)

    def test_last_sleeve_takes_the_remainder(self):
        legs = [
            {"symbol": "A", "mint": "So11111111111111111111111111111111111111112", "group": "crypto", "bps": 3334, "price": "100", "apy": None},
            {"symbol": "B", "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "group": "listed", "bps": 3333, "price": "1", "apy": None},
            {"symbol": "C", "mint": "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", "group": "stake", "bps": 3333, "price": "200", "apy": "0.10"},
        ]
        out = price({"name": "Four universes", "usd": "100", "legs": legs})
        self.assertEqual(sum(int(DecimalUsd(row["usd"])) for row in out["legs"]), 10000)
        self.assertEqual(out["legs"][0]["usd"], "33.34")
        self.assertEqual(out["legs"][2]["income"], "3.33")

    def test_instruction_is_the_program_layout(self):
        raw = encode("Stake book", STAKE)
        self.assertEqual(raw[0], 0)
        self.assertEqual(raw[1:17], b"Stake book" + b"\x00" * 6)
        self.assertEqual(raw[17], 5)
        self.assertEqual(len(raw), 18 + 5 * 34)
        self.assertEqual(int.from_bytes(raw[-2:], "little"), 2000)

    def test_rejects_a_bad_recipe(self):
        bad = [dict(row) for row in STAKE[:2]]
        bad[0]["bps"] = 1000
        with self.assertRaises(ValueError):
            price({"name": "Stake book", "usd": "100", "legs": bad})
        with self.assertRaises(ValueError):
            price({"name": "Stake book", "usd": "0", "legs": STAKE})
        missing = [dict(row) for row in STAKE]
        missing[0]["price"] = "0"
        with self.assertRaises(ValueError):
            price({"name": "Stake book", "usd": "100", "legs": missing})


def DecimalUsd(text: str) -> int:
    return int(round(float(text) * 100))


if __name__ == "__main__":
    unittest.main()
