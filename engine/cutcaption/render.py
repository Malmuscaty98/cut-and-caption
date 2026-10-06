"""`cut-and-caption render` / `cut-and-caption srt` — the editor's own Remotion composition → MP4 (+ SRT).

The picture is rendered muted by Remotion; the sound is added by ffmpeg afterwards: with no cuts
the original audio stream is copied bit-exact, with cuts the click-free track from audio.py.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

from .audio import build as build_audio, has_cuts
from .media import MediaError, probe, run
from .paths import PROJECTS, node_exe, studio_dir, tool_env

_NO_WINDOW = {"creationflags": 0x08000000} if sys.platform == "win32" else {}


def project_dir(project):
    p = Path(project)
    if (p / "project.json").exists():
        return p.resolve()
    d = PROJECTS / project
    if not (d / "project.json").exists():
        raise MediaError(f"project not found: {project} (looked in {PROJECTS})")
    return d


def run_script(script, args, emit):
    """Run a studio TS script with the bundled Node, forwarding its JSON progress lines."""
    studio = studio_dir()
    tsx = studio / "node_modules" / "tsx" / "dist" / "cli.mjs"
    if not tsx.exists():
        raise MediaError("the editor isn't installed yet — run: cut-and-caption setup")
    proc = subprocess.Popen([str(node_exe()), str(tsx), f"scripts/{script}", *args], cwd=studio,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=tool_env(),
                            text=True, encoding="utf-8", errors="replace", **_NO_WINDOW)
    result, tail = {}, []
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            j = json.loads(line)
        except json.JSONDecodeError:
            tail = (tail + [line])[-12:]
            if "Downloading" in line or "rror" in line:
                emit(line)
            continue
        result.update(j)
        emit(j.get("msg", ""), **{k: v for k, v in j.items() if k != "msg"})
    if proc.wait() != 0:
        raise MediaError(f"{script} failed:\n" + "\n".join(tail))
    return result


def srt(project, emit=print):
    d = project_dir(project)
    return run_script("srt.ts", [str(d)], emit).get("out")


def render(project, aspect=None, draft=False, crf=None, emit=print):
    d = project_dir(project)
    p = json.loads((d / "project.json").read_text(encoding="utf-8"))
    args = [str(d), "--progress-json", "--muted"]
    if draft:
        args.append("--proxy")
    if aspect:
        args += ["--aspect", aspect]
    if crf is not None:
        args += ["--crf", str(crf)]
    res = run_script("render.ts", args, emit)
    out = Path(res["out"])

    tmp = out.with_name(out.stem + ".tmp.mp4")
    if has_cuts(p):
        wav = build_audio(d, log=lambda m: emit(m))
        run(["-v", "error", "-y", "-i", out, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
             "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-shortest", "-movflags", "+faststart", tmp])
        emit("• audio: your original sound, cut with 12 ms fades (no clicks)")
    else:
        run(["-v", "error", "-y", "-i", out, "-i", d / p["source"]["path"], "-map", "0:v:0", "-map", "1:a:0",
             "-c", "copy", "-shortest", "-movflags", "+faststart", tmp])
        emit("• audio: your original sound stream, copied untouched")
    tmp.replace(out)

    q = probe(out)
    mbps = out.stat().st_size * 8 / max(q["duration"], 0.001) / 1e6
    emit(f"• quality: {q['width']}×{q['height']} @ {q['fps']:g} fps · {mbps:.1f} Mb/s · {q['color_space']}")
    shutil.copy2(d / "project.json", out.with_suffix(".project.json"))
    srt_out = srt(d, emit=lambda m, **k: None)
    emit(f"✓ video: {out}", out=str(out), done=True)
    emit(f"✓ SRT: {srt_out}")
    return out
