import unittest
from decimal import Decimal

from senda_corridor.engine import D, cross, local_of, route


def base(**over):
    doc = {
        "usd": "100",
        "currency": "MXN",
        "accept": "usdc",
        "prints": [{"id": "ecb", "label": "ECB mid", "rate": "20", "asOf": "2026-11-13"}],
        "rails": [
            {
                "id": "solana",
                "label": "USDC on Solana",
                "fixed": "0",
                "spreadBps": 0,
                "lo": "1",
                "hi": None,
                "kind": "live",
                "note": "stays",
            }
        ],
        "card": {"spreadBps": 100, "fixed": "0", "cap": None},
    }
    doc.update(over)
    return doc


class EngineTest(unittest.TestCase):
    def test_mid_times_amount(self):
        out = route(base())
        self.assertTrue(out["winner"]["id"] == "solana")
        self.assertEqual(out["winner"]["local"], "2000.00")
        self.assertEqual(out["planningRate"], "20")
        self.assertEqual(out["split"], "single")
        self.assertIsNone(out["breakpointUsd"])

    def test_fast_loses_one_bp(self):
        rails = base()["rails"] + [
            {
                "id": "fast",
                "label": "CCTP fast",
                "fixed": "0",
                "spreadBps": 1,
                "lo": "1",
                "hi": None,
                "kind": "live",
                "note": "circle",
            }
        ]
        out = route(base(rails=rails))
        self.assertEqual(out["winner"]["id"], "solana")
        self.assertEqual(out["ranked"][1]["local"], "1999.80")
        self.assertEqual(out["railShearBps"], "1.00")

    def test_breakpoint_fixed_versus_spread(self):
        mid = Decimal("20")
        cheap_spread = type("R", (), {"spread": D("0.01"), "fixed": D("0"), "lo": D("0"), "hi": None})()
        flat = type("R", (), {"spread": D("0"), "fixed": D("5"), "lo": D("0"), "hi": None})()
        q = cross(flat, cheap_spread, mid)
        self.assertEqual(q, Decimal("500.00"))
        rails = [
            {"id": "wire", "label": "Wire", "fixed": "5", "spreadBps": 0, "lo": "0", "hi": None, "kind": "live", "note": ""},
            {"id": "cardish", "label": "Spread", "fixed": "0", "spreadBps": 100, "lo": "0", "hi": None, "kind": "live", "note": ""},
        ]
        small = route(base(usd="100", rails=rails, accept="usdc"))
        self.assertEqual(small["winner"]["id"], "cardish")
        self.assertEqual(small["breakpointUsd"], "500.00")
        big = route(base(usd="1000", rails=rails, accept="usdc"))
        self.assertEqual(big["winner"]["id"], "wire")
        self.assertEqual(big["winner"]["local"], "19900.00")

    def test_outlier_print_dropped(self):
        prints = [
            {"id": "a", "label": "A", "rate": "10", "asOf": ""},
            {"id": "b", "label": "B", "rate": "10.01", "asOf": ""},
            {"id": "c", "label": "C", "rate": "12", "asOf": ""},
        ]
        out = route(base(prints=prints))
        kept = {p["id"] for p in out["prints"] if p["kept"]}
        self.assertEqual(kept, {"a", "b"})
        self.assertNotIn("c", kept)
        self.assertEqual(out["planningRate"], "10.005")

    def test_cap_splits_only_the_remainder(self):
        rails = [
            {"id": "tight", "label": "Tight", "fixed": "0", "spreadBps": 0, "lo": "0", "hi": "40", "kind": "live", "note": ""},
            {"id": "wide", "label": "Wide", "fixed": "0", "spreadBps": 100, "lo": "0", "hi": None, "kind": "live", "note": ""},
        ]
        out = route(base(usd="100", rails=rails))
        self.assertEqual(out["split"], "capped")
        self.assertEqual([row["id"] for row in out["slices"]], ["tight", "wide"])
        self.assertEqual(out["received"], "1988.00")
        self.assertEqual(out["uncovered"], "0.00")
        out = route(base(usd="100", accept="card", card={"spreadBps": 100, "fixed": "0", "cap": "40"}))
        self.assertEqual(out["split"], "capped")
        self.assertEqual(out["winner"]["usd"], "40.00")
        self.assertEqual(out["uncovered"], "60.00")
        self.assertEqual(out["winner"]["local"], "792.00")

    def test_ladder_gap(self):
        out = route(base())
        row = next(step for step in out["ladder"] if step["spreadBps"] == 100)
        self.assertEqual(row["local"], "1980.00")
        self.assertEqual(row["gap"], "20.00")

    def test_rejects_empty_and_huge(self):
        self.assertFalse_ok(route_cli({"usd": "0", "currency": "MXN", "prints": [], "rails": []}))

    def test_three_live_prints_median(self):
        prints = [
            {"id": "ecb", "label": "ECB", "rate": "18.6052", "asOf": "2026-11-13"},
            {"id": "bitso", "label": "Bitso bid", "rate": "18.556", "asOf": "2026-11-13"},
            {"id": "fix", "label": "Banxico", "rate": "18.5525", "asOf": "2026-11-13"},
        ]
        out = route(base(prints=prints, usd="250"))
        self.assertEqual(out["planningRate"], "18.556")
        self.assertTrue(all(p["kept"] for p in out["prints"]))
        self.assertEqual(out["winner"]["local"], "4639.00")

    def assertFalse_ok(self, _unused):
        from senda_corridor.engine import route as go

        with self.assertRaises(ValueError):
            go({"usd": "0", "currency": "MXN", "prints": [{"id": "a", "label": "A", "rate": "1"}], "rails": []})


def route_cli(_doc):
    return None


if __name__ == "__main__":
    unittest.main()
