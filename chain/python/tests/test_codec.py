import unittest

from senda.book import Name, cheapest, from_payload, premium
from senda.cover import CoverTerms
from senda.pay import memo, transfer, usd_to_atoms


class Codec(unittest.TestCase):
    def test_one_dollar_matches_the_rust_transfer(self):
        self.assertEqual(usd_to_atoms(1), 1_000_000)
        self.assertEqual(transfer(1_000_000), bytes([3, 0x40, 0x42, 0x0F, 0, 0, 0, 0, 0]))
        self.assertEqual(memo(1, "ref11111111111111111111111111111111"), "Senda USDC 1.00 ref=ref11111111111111111111111111111111")

    def test_cover_memo_matches_the_rust_terms(self):
        terms = CoverTerms("drop", "openai", 12.5, 100, 4, 1_700_000_000)
        self.assertEqual(
            terms.memo(),
            "Senda cover drop OPENAI strike=12500000 cover=100000000 premium=4000000 until=1700000000",
        )

    def test_the_cheap_print_sorts_first(self):
        book = [
            Name("OPENAI", "a", 11, 10),
            Name("ANDURIL", "b", 8, 10),
        ]
        self.assertEqual(cheapest(book, 1)[0].symbol, "ANDURIL")
        self.assertAlmostEqual(premium(8, 10), -0.2)

    def test_the_public_book_shape(self):
        rows = from_payload(
            [
                {"symbol": "SPACEX", "contract_address": "mint", "tokenPrice": 9, "markPrice": 10, "name": "SpaceX"},
                {"symbol": "", "contract_address": "nope"},
            ]
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].symbol, "SPACEX")


if __name__ == "__main__":
    unittest.main()
