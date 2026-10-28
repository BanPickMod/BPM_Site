"""Pseudonymous player identifiers (docs/Privacy_Compliance_Additional_Plan.md, A3).

A replay names both players by Battle.net handle. The site must tell that two uploads are one game (the map, both players and
the start time agree) but has no use for a stranger's handle itself. So the handle never leaves the worker: it is replaced
by a keyed hash. The same handle gives the same value as long as BPM_HANDLE_KEY stays the same, which is all the matching
needs, and nobody without the key can turn a value back into a handle or test a guess.

Keep the key stable. Changing it makes new analyses stop matching old ones (they fall back to the draft-and-result fingerprint).
"""
from __future__ import annotations

import hashlib
import hmac
import os

KEY_ENV = "BPM_HANDLE_KEY"
MIN_KEY_CHARS = 32
AI_HANDLE = "0-S2-0-0"


class KeyMissing(RuntimeError):
    pass


def _key() -> bytes:
    key = os.environ.get(KEY_ENV, "")
    if len(key) < MIN_KEY_CHARS:
        raise KeyMissing(f"{KEY_ENV} must be set to a secret of at least {MIN_KEY_CHARS} characters")
    return key.encode("utf8")


def require_key() -> None:
    """Fail at start-up, not on the first replay, when the secret is missing."""
    _key()


def handle_key(handle: str | None) -> str | None:
    """Keyed hash of a Battle.net handle ("2-S2-1-1234567"), or None for no handle / the AI placeholder."""
    if handle in (None, "", AI_HANDLE):
        return None
    return hmac.new(_key(), f"handle:{handle}".encode("utf8"), hashlib.sha256).hexdigest()[:32]
