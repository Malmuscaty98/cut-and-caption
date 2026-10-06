"""`cut-and-caption` command line. Messages are plain English; Claude relays them in the user's language."""
import argparse
import json
import sys

from . import __version__


def emitter(a):
    """Plain lines for humans; JSON lines when the editor runs the command (--progress-json)."""
    if getattr(a, "progress_json", False):
        return lambda msg="", **extra: print(json.dumps({"msg": msg, **extra}, ensure_ascii=False), flush=True)
    return lambda msg="", **extra: msg and print(msg, flush=True)


def guarded(fn):
    def run(a):
        from .media import MediaError
        try:
            return fn(a)
        except MediaError as e:
            emitter(a)(f"✗ {e}")
            return 1
    return run


@guarded
def cmd_setup(a):
    from .setup import setup
    return setup(model=a.model, yes=a.yes, log=emitter(a))


@guarded
def cmd_doctor(a):
    from .setup import doctor
    return doctor(model=a.model, log=emitter(a))


@guarded
def cmd_analyze(a):
    from .analyze import analyze
    analyze(a.input, name=a.name, aspect=a.aspect, preset=a.preset, model=a.model,
            language=None if a.language in (None, "auto") else a.language, force=a.force, like=a.like,
            no_cuts=a.no_cuts, threshold=a.threshold, min_silence=a.min_silence, padding=a.padding,
            min_speech=a.min_speech)


@guarded
def cmd_recut(a):
    from .recut import recut
    from .render import project_dir
    recut(project_dir(a.project), preset=a.preset, threshold=a.threshold, min_silence=a.min_silence,
          padding=a.padding, min_speech=a.min_speech, log=emitter(a))


@guarded
def cmd_zoom(a):
    from .render import project_dir
    from .zoom import run
    run(project_dir(a.project), cuts=a.cuts, emphasis=a.emphasis, apply=a.apply, scale=a.scale, x=a.x, y=a.y,
        every=a.every, clear=a.clear, log=emitter(a))


@guarded
def cmd_shots(a):
    from .render import project_dir
    from .shots import run
    run(project_dir(a.project), log=emitter(a))


@guarded
def cmd_render(a):
    from .render import render
    render(a.project, aspect=a.aspect, draft=a.draft, crf=a.crf, emit=emitter(a))


@guarded
def cmd_srt(a):
    from .render import srt
    out = srt(a.project, emit=lambda m, **k: None)
    emitter(a)(f"✓ {out}", out=out, done=True)


@guarded
def cmd_studio(a):
    from .studio import open_project, stop
    if a.stop:
        return stop(log=emitter(a))
    open_project(a.project, browser=not a.no_browser, log=emitter(a))


def cmd_projects(a):
    from .paths import PROJECTS
    rows = []
    for d in sorted(PROJECTS.glob("*/project.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            p = json.loads(d.read_text(encoding="utf-8"))
            rows.append(f"{d.parent.name}\t{p['source']['duration']:.1f}s\t{len(p['captions'])} lines\t{len(p['cuts'])} cuts")
        except Exception:
            continue
    print("\n".join(rows) if rows else f"no projects yet in {PROJECTS}")


def run_helper(args):
    """`cut-and-caption pj …` — the skill's project helper (skills/video/scripts/project_tool.py) run with this
    environment's Python, so it works the same where `python3` isn't on PATH (Windows)."""
    import runpy
    from .paths import ROOT
    script = ROOT / "skills" / "video" / "scripts" / "project_tool.py"
    sys.argv = [str(script), *args]
    runpy.run_path(str(script), run_name="__main__")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["pj"]:
        return run_helper(argv[1:])
    if argv[:1] == ["ffmpeg"]:  # the bundled ffmpeg, for checks and samples (no system install needed)
        import subprocess
        from .media import ffmpeg
        sys.exit(subprocess.call([ffmpeg(), *argv[1:]]))
    ap = argparse.ArgumentParser(prog="cut-and-caption", description="Cut & Caption — silence cuts, precise captions and zooms")
    ap.add_argument("--version", action="version", version=f"cut-and-caption {__version__}")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add(name, fn, help_, project=False):
        p = sub.add_parser(name, help=help_)
        if project:
            p.add_argument("project", help="project name (or folder)")
        p.add_argument("--progress-json", action="store_true", help=argparse.SUPPRESS)
        p.set_defaults(fn=fn)
        return p

    p = add("setup", cmd_setup, "install / update everything (asks before the model download)")
    p.add_argument("--model", help="Whisper model (default: large-v3 on Apple Silicon, large-v3-turbo elsewhere)")
    p.add_argument("--yes", action="store_true", help="the user agreed to download the model")
    p = add("doctor", cmd_doctor, "check that everything is ready")
    p.add_argument("--model")

    p = add("analyze", cmd_analyze, "video or folder of clips → project (transcript, silence cuts, captions)")
    p.add_argument("input")
    p.add_argument("--name")
    p.add_argument("--aspect", choices=["9:16", "16:9", "1:1", "4:5"])
    p.add_argument("--language", help="ar, en, fr… (default: detect)")
    p.add_argument("--model")
    p.add_argument("--preset", choices=["tight", "natural"], default="tight", help="silence cutting style")
    p.add_argument("--no-cuts", action="store_true", help="pauses already trimmed: don't cut")
    p.add_argument("--like", help="copy the caption look of an earlier project")
    p.add_argument("--force", action="store_true")
    for k in ("threshold", "min-silence", "padding", "min-speech"):
        p.add_argument(f"--{k}", type=float)

    p = add("recut", cmd_recut, "recompute the silence cuts (never cuts a word)", project=True)
    p.add_argument("--preset", choices=["tight", "natural"], default="tight")
    for k in ("threshold", "min-silence", "padding", "min-speech"):
        p.add_argument(f"--{k}", type=float)

    p = add("zoom", cmd_zoom, "add punch-in zooms (at cuts and on emphasized words)", project=True)
    p.add_argument("--no-cuts", dest="cuts", action="store_false", help="no zooms at the cuts")
    p.add_argument("--no-emphasis", dest="emphasis", action="store_false", help="no zooms on emphasized words")
    p.add_argument("--apply", action="store_true", help="switch them on now (default: proposed)")
    p.add_argument("--scale", type=float)
    p.add_argument("--x", type=float, default=0.5, help="zoom centre, 0–1 of the width")
    p.add_argument("--y", type=float, default=0.35, help="zoom centre, 0–1 of the height (face ≈ 0.3–0.4)")
    p.add_argument("--every", type=int, default=2, help="punch in every Nth piece between cuts")
    p.add_argument("--clear", action="store_true", help="remove all zooms first")

    add("shots", cmd_shots, "re-measure brightness per shot (caption auto contrast)", project=True)
    p = add("render", cmd_render, "export MP4 + SRT (exactly what the editor shows)", project=True)
    p.add_argument("--aspect", choices=["9:16", "16:9", "1:1", "4:5"])
    p.add_argument("--draft", action="store_true", help="fast preview quality")
    p.add_argument("--crf", type=int)
    add("srt", cmd_srt, "export subtitles (.srt) only", project=True)
    p = add("studio", cmd_studio, "open the editor in the browser")
    p.add_argument("project", nargs="?")
    p.add_argument("--no-browser", action="store_true")
    p.add_argument("--stop", action="store_true")
    add("projects", cmd_projects, "list projects")
    sub.add_parser("pj", help="project helper: summary, captions, words, cuts, validate, diff, snapshot, restore, save")
    sub.add_parser("ffmpeg", help="run the bundled ffmpeg")

    a = ap.parse_args(argv)
    if a.cmd == "zoom" and not (a.cuts or a.emphasis):
        ap.error("nothing to do: both --no-cuts and --no-emphasis")
    rc = a.fn(a)
    sys.exit(rc if isinstance(rc, int) else 0)
