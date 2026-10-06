"""ffmpeg and media probing, identical on macOS, Windows and Linux.

ffmpeg comes from the imageio-ffmpeg wheel (a complete static build — no separate install, same
version everywhere); CUTCAPTION_FFMPEG overrides it. Probing uses PyAV (FFmpeg's libraries as a wheel),
so no ffprobe is needed.
"""
import os
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm"}
COLOR_SPACES = {0: "gbr", 1: "bt709", 2: None, 4: "fcc", 5: "bt470bg", 6: "smpte170m", 7: "smpte240m", 9: "bt2020nc"}


class MediaError(RuntimeError):
    pass


@lru_cache(None)
def ffmpeg() -> str:
    exe = os.environ.get("CUTCAPTION_FFMPEG")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:  # pragma: no cover - only without the wheel
        raise MediaError(f"ffmpeg is missing (imageio-ffmpeg): {e}")


# Hide the console window ffmpeg would flash on Windows when started from a GUI process.
_NO_WINDOW = {"creationflags": 0x08000000} if sys.platform == "win32" else {}


def run(args, **kw):
    """Run ffmpeg (args without the program name). Raises MediaError with the stderr tail."""
    p = subprocess.run([ffmpeg(), *map(str, args)], capture_output=True, **_NO_WINDOW, **kw)
    if p.returncode != 0:
        err = p.stderr.decode("utf-8", "replace") if isinstance(p.stderr, bytes) else p.stderr
        tail = "\n".join(err.strip().splitlines()[-8:])
        raise MediaError(f"ffmpeg failed:\n{tail}")
    return p


def run_text(args):
    """ffmpeg run whose stderr is parsed (silencedetect, loudnorm…). Never raises on exit code."""
    p = subprocess.run([ffmpeg(), *map(str, args)], capture_output=True, **_NO_WINDOW)
    return p.stderr.decode("utf-8", "replace")


def _secs(value, time_base):
    return float(value * time_base) if value is not None and time_base is not None else None


def probe(path):
    import av
    try:
        c = av.open(str(path))
    except Exception as e:
        raise MediaError(f"can't read {path}: {e}")
    with c:
        if not c.streams.video:
            raise MediaError(f"no video in {path}")
        if not c.streams.audio:
            raise MediaError(f"no audio in {path}")
        v, a = c.streams.video[0], c.streams.audio[0]
        vc, ac = v.codec_context, a.codec_context
        rotation = 0
        try:
            rotation = int(next(c.decode(video=0)).rotation or 0)
        except Exception:
            pass
        w, h = vc.width, vc.height
        if abs(rotation) in (90, 270):
            w, h = h, w
        duration = c.duration / 1_000_000 if c.duration else _secs(v.duration, v.time_base) or 0.0
        fps = float(v.base_rate or v.average_rate or v.guessed_rate or 30)
        channels = getattr(ac, "channels", None) or ac.layout.nb_channels
        return {
            "path": str(path),
            "duration": float(duration),
            "width": int(w),
            "height": int(h),
            "fps": fps,
            "avg_fps": float(v.average_rate) if v.average_rate else 0.0,
            "vcodec": vc.name,
            "pix_fmt": vc.format.name if vc.format else None,
            "rotation": rotation,
            "v_start": _secs(v.start_time, v.time_base) or 0.0,
            "a_start": _secs(a.start_time, a.time_base) or 0.0,
            "v_duration": _secs(v.duration, v.time_base),
            "a_duration": _secs(a.duration, a.time_base),
            "color_space": COLOR_SPACES.get(getattr(vc, "colorspace", 2)),
            "acodec": ac.name,
            "sample_rate": int(ac.sample_rate),
            "channels": int(channels),
        }


def span(info):
    """(offset, length): earliest start of video/audio, and how long the clip lasts from there.
    Phone clips often start video a frame after audio; the concat filter keeps that offset."""
    spans = []
    for s, d in ((info["v_start"], info["v_duration"]), (info["a_start"], info["a_duration"])):
        if s is not None and d:
            spans.append((s, s + d))
    if not spans:
        return 0.0, info["duration"]
    m = min(s for s, _ in spans)
    return m, max(e for _, e in spans) - m


def natural_key(p: Path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", p.name)]


def list_clips(folder: Path):
    clips = sorted((p for p in folder.iterdir() if p.suffix.lower() in VIDEO_EXT and not p.name.startswith(".")),
                   key=natural_key)
    if not clips:
        raise MediaError(f"no video files in {folder}")
    return clips
