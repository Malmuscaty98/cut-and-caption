"""Acoustic silence detection with ffmpeg silencedetect."""
import re
from pathlib import Path

from .media import run_text

PRESETS = {
    # punchy short-form: breaths are cut, only very short pauses survive
    "tight":   {"threshold": -35.0, "min_silence": 0.20, "padding": 0.05, "min_speech": 0.20},
    "natural": {"threshold": -35.0, "min_silence": 0.45, "padding": 0.10, "min_speech": 0.25},
}


BLIP = 0.04       # a click/lip-smack shorter than this doesn't break a pause
PROBE_MIN = 0.08  # detect short pieces first, then merge across blips


def detect(wav: Path, threshold: float, min_silence: float, duration: float):
    """Silent intervals [(start, end)] ≥ min_silence, in seconds.

    silencedetect splits a pause at any tiny click; detecting short pieces and merging those
    separated by < BLIP recovers the real pause.
    """
    pieces = _detect_raw(wav, threshold, min(PROBE_MIN, min_silence), duration)
    merged = []
    for a, b in pieces:
        if merged and a - merged[-1][1] < BLIP:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a, b) for a, b in merged if b - a >= min_silence]


def _detect_raw(wav, threshold, min_silence, duration):
    err = run_text(["-hide_banner", "-nostats", "-i", wav, "-af",
                    f"silencedetect=noise={threshold}dB:d={min_silence}", "-f", "null", "-"])
    out, start = [], None
    for m in re.finditer(r"silence_(start|end): (-?[\d.]+)", err):
        t = max(0.0, float(m.group(2)))
        if m.group(1) == "start":
            start = t
        elif start is not None:
            out.append((start, min(t, duration)))
            start = None
    if start is not None:                        # silence runs to the end of the file
        out.append((start, duration))
    return out
