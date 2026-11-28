import unittest

from senda.treasury import fund_data, pack, unpack


class Treasury(unittest.TestCase):
    def test_the_bytes_match_the_native_account(self):
        raw = pack(2, False, bytes([1]) * 32, 1000, 1, bytes([2]) * 32)
        self.assertEqual(raw[:12], b"SENDATRY" + bytes([1, 2, 0, 0]))
        self.assertEqual(raw[44], 0xE8)
        self.assertEqual(unpack(raw)["spend_open"], False)
        self.assertEqual(unpack(raw)["funded"], 1000)
        self.assertIsNone(fund_data(0))
        self.assertEqual(fund_data(1000)[0], 1)
