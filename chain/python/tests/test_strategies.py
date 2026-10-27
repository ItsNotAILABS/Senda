import unittest

from senda.book import Name
from senda.strategies import exit_reason, intents, pick_dip, sized


class Strategies(unittest.TestCase):
    def test_discount_buys_and_rich_sells(self):
        book = [
            Name("CHEAP", "mint-cheap", 8, 10),
            Name("FLAT", "mint-flat", 10, 10),
            Name("RICH", "mint-rich", 12, 10),
        ]
        rows = intents(book, 25, 10)
        self.assertEqual(rows[0]["symbol"], "CHEAP")
        self.assertEqual(rows[0]["side"], "buy")
        self.assertEqual(rows[0]["usd"], 10)
        self.assertEqual(rows[-1]["symbol"], "RICH")
        self.assertEqual(rows[-1]["side"], "sell")
        self.assertNotIn("FLAT", [row["symbol"] for row in rows])

    def test_a_zero_size_sends_nothing(self):
        self.assertEqual(intents([Name("CHEAP", "m", 8, 10)], 0), [])
        self.assertEqual(sized(25, 10), 10)
        self.assertEqual(sized(0, 10), 0)

    def test_dip_skips_crashes_and_stables(self):
        rows = [
            {"symbol": "USDC", "price": 1, "change": -0.04, "liq": 9_000_000},
            {"symbol": "RUG", "price": 1, "change": -0.4, "liq": 900_000},
            {"symbol": "THIN", "price": 1, "change": -0.04, "liq": 1_000},
            {"symbol": "DIP", "price": 2, "change": -0.05, "liq": 400_000},
            {"symbol": "NEAR", "price": 3, "change": -0.041, "liq": 500_000},
        ]
        self.assertEqual(pick_dip(rows)["symbol"], "NEAR")
        self.assertIsNone(pick_dip([{"symbol": "UP", "price": 1, "change": 0.1, "liq": 1_000_000}]))

    def test_exit_is_wider_on_the_win(self):
        self.assertEqual(exit_reason(100, 104, 1, 2), "take")
        self.assertEqual(exit_reason(100, 97, 1, 2), "stop")
        self.assertIsNone(exit_reason(100, 101, 1, 2))
        self.assertEqual(exit_reason(100, 101, 1, 1 + 36 * 60 * 60 * 1000), "time")


if __name__ == "__main__":
    unittest.main()
