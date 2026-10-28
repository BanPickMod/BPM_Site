"""Player handles never leave the worker: they become a keyed hash (A3 in docs/Privacy_Compliance_Additional_Plan.md)."""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bpm_replay import pseudonym  # noqa: E402

KEY = "test-handle-key-0123456789abcdef0123456789"


class Pseudonym(unittest.TestCase):
    def setUp(self):
        self.old = os.environ.get(pseudonym.KEY_ENV)
        os.environ[pseudonym.KEY_ENV] = KEY

    def tearDown(self):
        if self.old is None:
            os.environ.pop(pseudonym.KEY_ENV, None)
        else:
            os.environ[pseudonym.KEY_ENV] = self.old

    def test_same_handle_same_value_and_it_does_not_contain_the_handle(self):
        a, b = pseudonym.handle_key("2-S2-1-1234567"), pseudonym.handle_key("2-S2-1-1234567")
        self.assertEqual(a, b)
        self.assertEqual(len(a), 32)
        self.assertNotIn("1234567", a)

    def test_different_handles_and_different_keys_give_different_values(self):
        h1, h2 = pseudonym.handle_key("2-S2-1-1"), pseudonym.handle_key("2-S2-1-2")
        self.assertNotEqual(h1, h2)
        os.environ[pseudonym.KEY_ENV] = "another-handle-key-0123456789abcdef012345"
        self.assertNotEqual(h1, pseudonym.handle_key("2-S2-1-1"))

    def test_no_handle_and_the_ai_placeholder_have_no_value(self):
        for h in (None, "", "0-S2-0-0"):
            self.assertIsNone(pseudonym.handle_key(h))

    def test_a_missing_or_short_key_is_refused(self):
        for bad in ("", "short"):
            os.environ[pseudonym.KEY_ENV] = bad
            with self.assertRaises(pseudonym.KeyMissing):
                pseudonym.handle_key("2-S2-1-1")
            with self.assertRaises(pseudonym.KeyMissing):
                pseudonym.require_key()


if __name__ == "__main__":
    unittest.main()
