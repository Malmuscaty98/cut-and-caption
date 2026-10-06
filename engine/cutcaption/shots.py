"""Shots + brightness behind the captions, for auto contrast: light text normally, dark text where
the area behind the caption is light (a white T-shirt, a bright wall). Decided per shot, never per
caption, so the colour can't flicker inside one shot.

Each shot stores the median luminance of a 10×20 grid over the frame, so the composition reads
the cells right behind the text (centre ±32 % of the width, ±4 % of the height around the caption),
wherever the user drags it. A full-width band also catches the chair and the hands at the sides and
called a white T-shirt "dark" (0.54) in testing."""
import json
import subprocess
from datetime import datetime
from pathlib import Path

import numpy as np

from .media import ffmpeg

SAMPLE_FPS = 10
WIDTH = 64          # tiny grey frames are plenty for brightness and hard-cut detection
ROWS, COLS = 20, 10  # luminance grid per shot (5 % of the height × 10 % of the width per cell)
CUT = 0.09          # mean abs difference (0–1) between consecutive samples that starts a new shot
MIN_SHOT = 0.6      # s — shorter pieces (flashes, light leaks, a dissolve) join a neighbour
EDGE = 0.2          # s — samples this close to a cut are left out of a shot's brightness
# Default switch point. White text (+ dark shadow) and #161C1A (+ light glow) have equal WCAG
# contrast at a background of ≈ 0.48 (gamma-encoded); 0.6 left a white T-shirt with hands in
# front (0.56–0.61) flipping colour from shot to shot.
THRESHOLD = 0.5


def _frames(video: Path, w: int, h: int) -> np.ndarray:
    cmd = [ffmpeg(), "-v", "error", "-i", str(video), "-an",
           "-vf", f"fps={SAMPLE_FPS},scale={w}:{h}:flags=area:out_range=full,format=gray",
           "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (w * h)
    return np.frombuffer(raw[: n * w * h], np.uint8).reshape(n, h, w).astype(np.float32) / 255.0


def _cuts(frames: np.ndarray, boundaries: list[float]) -> list[float]:
    diff = np.abs(frames[1:] - frames[:-1]).mean(axis=(1, 2))
    times = [(i + 1) / SAMPLE_FPS for i in np.nonzero(diff > CUT)[0]]
    return sorted(set(round(t, 2) for t in times + boundaries))


def detect(video: Path, duration: float, width: int, height: int, boundaries=()) -> list[dict]:
    h = max(ROWS, round(WIDTH * height / width))
    f = _frames(video, WIDTH, h)
    if not len(f):
        return []
    cuts = [c for c in _cuts(f, list(boundaries)) if 0 < c < duration]
    edges = [0.0] + cuts + [duration]
    spans = [[a, b] for a, b in zip(edges, edges[1:]) if b > a]
    merged: list[list[float]] = []
    for s in spans:  # flashes and leaks are not shots
        if merged and (s[1] - s[0] < MIN_SHOT or merged[-1][1] - merged[-1][0] < MIN_SHOT):
            merged[-1][1] = s[1]
        else:
            merged.append(s)

    rows = np.array_split(np.arange(h), ROWS)
    cols = np.array_split(np.arange(WIDTH), COLS)
    cells = np.stack([f[:, r][:, :, c].mean(axis=(1, 2)) for r in rows for c in cols], axis=1)  # samples × cells
    t = np.arange(len(f)) / SAMPLE_FPS
    shots = []
    for a, b in merged:
        inner = (t >= a + EDGE) & (t < b - EDGE)
        if not inner.any():
            inner = (t >= a) & (t < b)
        if not inner.any():
            inner = np.abs(t - (a + b) / 2) == np.abs(t - (a + b) / 2).min()
        shots.append({"start": round(a, 3), "end": round(b, 3),
                      "grid": [round(float(v), 3) for v in np.median(cells[inner], axis=0)]})
    return shots


def measure(project_dir: Path, project: dict) -> list[dict]:
    src = project["source"]
    video = project_dir / (src.get("proxy") or "source.mp4")
    if not video.exists():
        video = project_dir / "source.mp4"
    boundaries = [s["start"] for s in src.get("segments", [])[1:]]
    return detect(video, src["duration"], src["width"], src["height"], boundaries)


def area_luma(grid: list[float], x0: float, x1: float, y0: float, y1: float) -> float:
    """Mean brightness of a region (0–1 coordinates), cells weighted by overlap — same as the studio."""
    total = weight = 0.0
    for i, v in enumerate(grid):
        r, c = divmod(i, COLS)
        ox = max(0.0, min(x1, (c + 1) / COLS) - max(x0, c / COLS))
        oy = max(0.0, min(y1, (r + 1) / ROWS) - max(y0, r / ROWS))
        total += v * ox * oy
        weight += ox * oy
    return total / weight if weight else 0.0


def caption_luma(grid: list[float], x: float = 0.5, y: float = 0.72, max_width: float = 0.92) -> float:
    half = max_width * 0.35
    return area_luma(grid, x - half, x + half, y - 0.04, y + 0.04)


def run(project_dir: Path, log=print):
    """`cut-and-caption shots` — (re)measure an existing project and save it."""
    pj = project_dir / "project.json"
    project = json.loads(pj.read_text(encoding="utf-8"))
    hist = project_dir / ".history"
    hist.mkdir(exist_ok=True)
    (hist / f"project.{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}-shots.json").write_text(
        pj.read_text(encoding="utf-8"), encoding="utf-8")
    log("measuring the brightness behind the captions, shot by shot…")
    project["shots"] = measure(project_dir, project)
    from .analyze import write_atomic
    write_atomic(pj, project)
    light = sum(1 for s in project["shots"] if caption_luma(s["grid"]) > THRESHOLD)
    log(f"✓ {len(project['shots'])} shots — {light} light behind the captions (dark text there)")
    return project["shots"]
