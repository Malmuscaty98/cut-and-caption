"""Input (one file or a folder of clips) → source.mp4, proxy.mp4, audio16k.wav.

Originals are only ever read. A finished export (H.264 8-bit, constant frame rate, starts at 0)
is copied bit-exact; anything else (phone HEVC, several clips) becomes one constant-frame-rate
H.264 mezzanine (`source.mp4`, starts at t=0, A/V aligned) that the whole pipeline uses.
"""
import sys
from pathlib import Path

from .media import MediaError, list_clips, probe, run, span

MAC = sys.platform == "darwin"
# Hardware H.264 on macOS (fast, ~transparent at 40 Mb/s); x264 elsewhere — works on every PC.
MEZZ_VIDEO = (["-c:v", "h264_videotoolbox", "-b:v", "40M", "-profile:v", "high", "-pix_fmt", "yuv420p"] if MAC
              else ["-c:v", "libx264", "-preset", "fast", "-crf", "15", "-profile:v", "high", "-pix_fmt", "yuv420p"])
DECODE_HW = ["-hwaccel", "videotoolbox"] if MAC else []


def normalize(clips, infos, out: Path):
    """Join (or just normalize) clips through the concat filter: exact A/V sync at every join
    (stream copy drifts ~40 ms per join on phone HEVC). Each clip keeps its own A/V offset."""
    fps = infos[0]["fps"]
    w, h = infos[0]["width"], infos[0]["height"]
    parts, labels = [], ""
    for i, info in enumerate(infos):
        m, _ = span(info)
        parts.append(f"[{i}:v:0]setpts=PTS-{m}/TB,scale={w}:{h}:force_original_aspect_ratio=decrease,"
                     f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps}[v{i}]")
        parts.append(f"[{i}:a:0]asetpts=PTS-{m}/TB,aresample=48000,aformat=channel_layouts=stereo[a{i}]")
        labels += f"[v{i}][a{i}]"
    graph = ";".join(parts) + f";{labels}concat=n={len(clips)}:v=1:a=1[v][a]"
    inputs = [x for c in clips for x in ("-i", c)]
    run(["-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", *MEZZ_VIDEO,
         "-r", fps, "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", out])


def is_clean_master(info):
    """A finished export the pipeline can use as-is: H.264 8-bit 4:2:0, constant frame rate,
    no rotation, audio and video both starting at 0, AAC audio."""
    return (info["vcodec"] == "h264" and info["pix_fmt"] == "yuv420p" and info["rotation"] == 0
            and info["avg_fps"] and abs(info["fps"] - info["avg_fps"]) < 1e-3
            and abs(info["v_start"]) < 1e-3 and abs(info["a_start"]) < 1e-3 and info["acodec"] == "aac")


def remux(src: Path, out: Path):
    run(["-v", "error", "-y", "-i", src, "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", "-movflags", "+faststart", out])


def make_proxy(src: Path, out: Path, fps: float):
    """720p H.264 for the editor: browsers seek phone HEVC poorly; a keyframe every 0.5 s."""
    gop = max(1, round(fps / 2))
    run(["-v", "error", "-y", *DECODE_HW, "-i", src,
         "-vf", "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)'",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
         "-g", gop, "-keyint_min", gop, "-sc_threshold", "0",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out])


def extract_wav(src: Path, out: Path):
    run(["-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out])


def ingest(inp: Path, proj: Path, log=print):
    """Returns the project's `source` dict. Paths inside it are relative to `proj`."""
    inp = Path(inp).expanduser().resolve()
    if inp.is_dir():
        clips = list_clips(inp)
    elif inp.is_file():
        clips = [inp]
    else:
        raise MediaError(f"not found: {inp}")
    infos = [probe(c) for c in clips]
    log(f"  {len(clips)} clip(s), {sum(i['duration'] for i in infos):.1f} s "
        f"({infos[0]['width']}×{infos[0]['height']}, {infos[0]['vcodec']} {infos[0]['pix_fmt']})")
    src = proj / "source.mp4"
    lossless = len(clips) == 1 and is_clean_master(infos[0])
    if lossless:
        remux(clips[0], src)
        log("  finished export → copied as-is (no re-encode, no quality loss)")
    else:
        log("  normalizing to one H.264 file (phone/several clips)…")
        normalize(clips, infos, src)
    info = probe(src)

    segments, t = [], 0.0
    for c, ci in zip(clips, infos):
        _, d = span(ci)
        segments.append({"file": str(c), "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    segments[-1]["end"] = round(info["duration"], 3)
    log("  editor preview copy (720p)…")
    make_proxy(src, proj / "proxy.mp4", info["fps"])
    extract_wav(src, proj / "audio16k.wav")
    return {
        "path": "source.mp4",
        "duration": round(info["duration"], 3),
        "fps": info["fps"],
        "width": info["width"],
        "height": info["height"],
        "codec": f"{infos[0]['vcodec']} {infos[0]['pix_fmt']}",
        "lossless": lossless,
        "proxy": "proxy.mp4",
        "audio": "audio16k.wav",
        "segments": segments,
    }
