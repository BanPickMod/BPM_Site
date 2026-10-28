"""Compatibility for running s2protocol on current Python versions (what a Railway service gets by default).

s2protocol's `versions` module loads its per-build protocol files with the `imp` module, which Python 3.12 removed. This installs a
small stand-in before s2protocol is imported. On Python 3.11 and older the real `imp` is used and nothing is changed.
"""
from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path


def install_imp_compat() -> None:
    try:
        import imp  # noqa: F401
        return
    except ModuleNotFoundError:
        pass
    module = types.ModuleType("imp")

    def find_module(name, paths):
        path = Path(paths[0]) / f"{name}.py"
        if not path.is_file():
            raise ImportError(f"protocol module not found: {name}")
        return path.open("r", encoding="utf8"), str(path), (".py", "r", 1)

    def load_module(name, file_obj, pathname, description):
        del file_obj, description
        spec = importlib.util.spec_from_file_location(name, pathname)
        loaded = importlib.util.module_from_spec(spec)
        sys.modules[name] = loaded
        spec.loader.exec_module(loaded)
        return loaded

    module.find_module = find_module
    module.load_module = load_module
    sys.modules["imp"] = module
