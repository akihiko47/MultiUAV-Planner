import ctypes
import json
import os
from pathlib import Path

LIB_PATH = os.getenv(
    "PLANNER_LIB",
    str(Path(__file__).parent.parent / "build" / "libplanner.so")
)

_lib = ctypes.CDLL(LIB_PATH)

_lib.plan_json.argtypes = [ctypes.c_char_p]
_lib.plan_json.restype = ctypes.c_void_p

_lib.free_string.argtypes = [ctypes.c_void_p]
_lib.free_string.restype = None


def call_planner(request_json: str) -> dict:
    req = request_json.encode("utf-8")
    ptr = _lib.plan_json(req)

    if not ptr:
        raise RuntimeError("C++ planner returned null")

    try:
        raw = ctypes.string_at(ptr).decode("utf-8")
    finally:
        _lib.free_string(ptr)

    result = json.loads(raw)

    if isinstance(result, dict) and "error" in result:
        raise RuntimeError(result["error"])

    return result