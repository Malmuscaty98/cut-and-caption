"""The final audio when there are cuts: renders/audio.wav (48 kHz stereo).

The kept pieces are joined with 12 ms fades at every cut (no clicks). Cut points come from the
same frame-snapped segments the editor's composition uses (studio/lib/timeline.ts), so picture
and sound are cut at exactly the same instants. With no cuts the original audio stream is copied
untouched instead (render.py).
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np

from .media import MediaError, ffmpeg

SR = 48000
FADE = 0.012
_NO_WINDOW = {"creationflags": 0x08000000} if sys.platform == "win32" else {}


def jround(x):
    """JavaScript Math.round (half up) — must match timeline.ts."""
    return math.floor(x + 0.5)


def kept_frames(p):
    """(fps, [(src_start, src_end, out_start)] in frames, output length in frames)."""
    fps = p["output"].get("fps") or p["source"]["fps"]
    total = max(1, jround(p["source"]["duration"] * fps))
    iv = sorted((jround(c["start"] * fps), jround(c["end"] * fps)) for c in p["cuts"] if c.get("enabled"))
    merged = []
    for a, b in iv:
        if b <= a:
            continue
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    segs, t, out = [], 0, 0
    for a, b in merged:
        if a > t:
            end = min(a, total)
            segs.append((t, end, out))
            out += end - t
        t = max(t, b)
    if t < total:
        segs.append((t, total, out))
    return fps, segs, sum(e - s for s, e, _ in segs)


def has_cuts(p):
    return any(c.get("enabled") for c in p.get("cuts", []))


def _decode(path):
    cmd = [ffmpeg(), "-v", "error", "-i", str(path), "-vn", "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    r = subprocess.run(cmd, capture_output=True, **_NO_WINDOW)
    if r.returncode != 0:
        raise MediaError(f"can't read the audio of {path}: {r.stderr.decode('utf-8', 'replace')[-300:]}")
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2)


def _encode(arr, path):
    r = subprocess.run([ffmpeg(), "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                        "-c:a", "pcm_s16le", str(path)], input=arr.astype(np.float32).tobytes(),
                       capture_output=True, **_NO_WINDOW)
    if r.returncode != 0:
        raise MediaError(r.stderr.decode("utf-8", "replace")[-300:])


def build(project_dir: Path, log=print) -> Path:
    p = json.loads((project_dir / "project.json").read_text(encoding="utf-8"))
    fps, segs, total_out = kept_frames(p)
    src = _decode(project_dir / p["source"]["path"])
    n_out = jround(total_out / fps * SR)
    out = np.zeros((n_out, 2), dtype=np.float32)
    f = int(FADE * SR)
    ramp = np.linspace(0, 1, f, dtype=np.float32)[:, None]
    log(f"• audio: {len(segs)} pieces, {int(FADE * 1000)} ms fade at every cut…")
    for s, e, o in segs:
        a, b = jround(s / fps * SR), jround(e / fps * SR)
        piece = src[a:min(b, len(src))].copy()
        if len(piece) > 2 * f:
            if s > 0:
                piece[:f] *= ramp
            if e < jround(p["source"]["duration"] * fps):
                piece[-f:] *= ramp[::-1]
        dst = jround(o / fps * SR)
        n = min(len(piece), n_out - dst)
        if n > 0:
            out[dst:dst + n] = piece[:n]
    renders = project_dir / "renders"
    renders.mkdir(exist_ok=True)
    wav = renders / "audio.wav"
    _encode(out, wav)
    return wav
